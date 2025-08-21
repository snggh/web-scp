package handlers

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/contrib/websocket"

	"github.com/user/web-scp/models"
	"github.com/user/web-scp/transfer"
)

type Client struct {
	ID          string
	UserSession string
	Conn        *websocket.Conn
	Send        chan []byte
	Hub         *Hub
}

type Hub struct {
	// Registered clients by user session
	clients    map[string]map[*Client]bool
	clientsMux sync.RWMutex

	// Register requests from the clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Broadcast message to all clients
	broadcast chan []byte

	// Broadcast message to specific user session
	userBroadcast chan UserMessage
}

type UserMessage struct {
	UserSession string
	Message     []byte
}


func NewHub() *Hub {
	return &Hub{
		clients:       make(map[string]map[*Client]bool),
		register:      make(chan *Client),
		unregister:    make(chan *Client),
		broadcast:     make(chan []byte),
		userBroadcast: make(chan UserMessage),
	}
}

func (h *Hub) Run() {
	log.Println("WebSocket hub started")
	for {
		select {
		case client := <-h.register:
			h.clientsMux.Lock()
			if h.clients[client.UserSession] == nil {
				h.clients[client.UserSession] = make(map[*Client]bool)
			}
			h.clients[client.UserSession][client] = true
			h.clientsMux.Unlock()
			log.Printf("Client %s registered for session %s", client.ID, client.UserSession)

		case client := <-h.unregister:
			h.clientsMux.Lock()
			if clients, ok := h.clients[client.UserSession]; ok {
				if _, ok := clients[client]; ok {
					delete(clients, client)
					close(client.Send)
					if len(clients) == 0 {
						delete(h.clients, client.UserSession)
					}
				}
			}
			h.clientsMux.Unlock()
			log.Printf("Client %s unregistered from session %s", client.ID, client.UserSession)

		case message := <-h.broadcast:
			h.clientsMux.RLock()
			for _, clients := range h.clients {
				for client := range clients {
					select {
					case client.Send <- message:
					default:
						close(client.Send)
						delete(clients, client)
					}
				}
			}
			h.clientsMux.RUnlock()

		case userMsg := <-h.userBroadcast:
			h.clientsMux.RLock()
			if clients, ok := h.clients[userMsg.UserSession]; ok {
				for client := range clients {
					select {
					case client.Send <- userMsg.Message:
					default:
						close(client.Send)
						delete(clients, client)
					}
				}
			}
			h.clientsMux.RUnlock()
		}
	}
}

func (h *Hub) BroadcastProgress(progress models.TransferProgress) {
	message := models.WSMessage{
		Type: "transfer_progress",
		Data: progress,
	}

	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling progress message: %v", err)
		return
	}

	// Broadcast to all clients for now
	// TODO: Broadcast only to the user session that owns the transfer
	select {
	case h.broadcast <- data:
	default:
		log.Printf("Failed to broadcast progress message")
	}
}

func (h *Hub) BroadcastMessage(msgType string, data interface{}) {
	message := models.WSMessage{
		Type: msgType,
		Data: data,
	}

	msgData, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	select {
	case h.broadcast <- msgData:
	default:
		log.Printf("Failed to broadcast message")
	}
}

func (h *Hub) BroadcastToUser(userSession, msgType string, data interface{}) {
	message := models.WSMessage{
		Type: msgType,
		Data: data,
	}

	msgData, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling user message: %v", err)
		return
	}

	userMsg := UserMessage{
		UserSession: userSession,
		Message:     msgData,
	}

	select {
	case h.userBroadcast <- userMsg:
	default:
		log.Printf("Failed to broadcast message to user %s", userSession)
	}
}

func (c *Client) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current message
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// HandleWebSocket handles WebSocket upgrade and connection
func (h *Hub) HandleWebSocket(c *fiber.Ctx) error {
	// Get user session from query parameter or header
	userSession := c.Query("session")
	if userSession == "" {
		userSession = c.Get("X-Session-ID")
	}
	if userSession == "" {
		return c.Status(400).JSON(fiber.Map{
			"error": "User session required",
		})
	}

	// Use Fiber's WebSocket upgrade
	return websocket.New(func(conn *websocket.Conn) {
		client := &Client{
			ID:          c.IP() + "-" + time.Now().Format("15:04:05"),
			UserSession: userSession,
			Conn:        conn,
			Send:        make(chan []byte, 256),
			Hub:         h,
		}

		client.Hub.register <- client

		// Start goroutines for handling the connection
		go client.writePump()
		go client.readPump()
	})(c)
}

var GlobalHub = NewHub()

// Initialize transfer manager with progress callback
func init() {
	transfer.GlobalTransferManager.SetProgressCallback(func(userSession string, progress models.TransferProgress) {
		GlobalHub.BroadcastToUser(userSession, "transfer_progress", progress)
	})
}