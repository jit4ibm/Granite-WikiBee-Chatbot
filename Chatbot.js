import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_URL } from "./config.js";

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Function to send message and interact with the bot
  const sendMessage = async () => {
    if (!userInput.trim()) {
      setError("Message cannot be empty.");
      return;
    }

    setError(null);
    setIsLoading(true);

    // Add user's message to the chat
    setMessages((prev) => [...prev, { sender: "User", text: userInput }]);

    try {
      const response = await axios.post(API_URL, { prompt: userInput }, {
        timeout: 100000, // Timeout set to 100 seconds
      });

      const botMessage = response.data.reply || "No response received.";
      setMessages((prev) => [...prev, { sender: "Bot", text: botMessage }]);
    } catch (err) {
      console.error("Error in API call:", err);

      // Handling specific error types
      let errorMessage = "Error: Unable to fetch response.";
      if (err.response) {
        // Server responded with an error
        errorMessage = err.response?.data?.error || "Server error.";
      } else if (err.request) {
        // No response from server
        errorMessage = "No response from the server. Please try again later.";
      } else if (err.code === 'ECONNABORTED') {
        // Request timeout
        errorMessage = "Request timed out. Please try again.";
      } else {
        // Network or other errors
        errorMessage = "Network error. Please check your connection.";
      }

      // Add the error message to chat
      setMessages((prev) => [...prev, { sender: "Bot", text: errorMessage }]);
    } finally {
      setIsLoading(false);
      setUserInput("");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Granite WikiBee Chatbot</h1>
      <div
        style={{
          height: "400px",
          overflowY: "scroll",
          border: "1px solid #ccc",
          padding: "10px",
          marginBottom: "10px",
        }}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              textAlign: msg.sender === "User" ? "right" : "left",
              margin: "10px 0",
            }}
          >
            <strong>{msg.sender}:</strong> {msg.text}
          </div>
        ))}
        {isLoading && (
          <div style={{ textAlign: "left", fontStyle: "italic" }}>
            Bot is typing...
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {error && <div style={{ color: "red" }}>{error}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Type your message..."
          aria-label="Chat input"
          style={{ flex: 1, padding: "10px" }}
          disabled={isLoading}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading}
          style={{ padding: "10px" }}
          aria-label="Send message"
        >
          {isLoading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
};

export default Chatbot;