import { sendMessage, listenForMessages } from 'backend/chatapp.jsw';
import {currentUser} from 'wix-users';

$w.onReady(() => {
	console.log(currentUser.id)
    const chatID = "sampleChatID";
    const senderID = currentUser.id;

    async function handleSendMessage() {
        const messageText = $w("#messageInput").value;
        if (messageText) {
            try {
                await sendMessage(chatID, senderID, messageText);
                console.log("Message sent successfully!");
                $w("#messageInput").value = "";
            } catch (error) {
                console.error("Error sending message:", error);
            }
        }
    }

    // Function to retrieve messages and log them to the console
    async function getChatMessages() {
        try {
            const messages = await listenForMessages(chatID);
            logMessages(messages);
        } catch (error) {
            console.error("Error retrieving messages:", error);
        }
    }

    // Function to log messages to the console
    function logMessages(messages) {
        messages.forEach((message) => {
            console.log(`New message from ${message.sender}: ${message.message}`);
        });
    }

    // Set up an event handler for the Send button
    $w("#sendButton").onClick(handleSendMessage);

    // Polling to get messages every 5 seconds
    setInterval(() => {
        getChatMessages();
    }, 5000);
});