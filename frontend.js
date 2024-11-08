import { sendMessage, getChatMessages, listenForMessages } from 'backend/chatapp.jsw';
import { subscribe } from 'wix-realtime';
import { currentUser } from 'wix-users';

$w.onReady(async () => {
    const chatID = "sampleChatID";
    const senderID = currentUser.id;

    // Load and display all previous messages
    await loadPreviousMessages(chatID);

    // Start listening for new messages in the backend
    await listenForMessages(chatID);

    const channel = { name: `chatMessages_${chatID}` };
    subscribe(channel, (message) => {
        const { payload } = message;
        const { sender, message: messageText } = payload;

        if (sender && messageText) {
            appendMessageToTextBox(sender, messageText);
        } else {
            console.warn("Received data with missing properties:", payload);
        }
    });

    $w("#sendButton").onClick(async () => {
        const messageText = $w("#messageInput").value;
        if (messageText) {
            try {
                await sendMessage(chatID, senderID, messageText);
                console.log("Message sent successfully!");
                $w("#messageInput").value = ""; // Clear the input after sending
            } catch (error) {
                console.error("Error sending message:", error);
            }
        }
    });

});

async function loadPreviousMessages(chatID) {
    try {
        const messages = await getChatMessages(chatID);
        messages.forEach((message) => {
            appendMessageToTextBox(message.sender, message.message);
        });
    } catch (error) {
        console.error("Error loading previous messages:", error);
    }
}

function appendMessageToTextBox(sender, messageText) {
    const currentText = $w("#textBoxChat").value;
    const newText = `${currentText}${sender.substring(0, 10)}: ${messageText}\n`;
    $w("#textBoxChat").value = newText;
}