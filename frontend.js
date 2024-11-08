import { sendMessage, getChatMessages, startListeningForMessages } from 'backend/chatapp.jsw';
import { subscribe } from 'wix-realtime';
import { currentUser } from 'wix-users';

let initialLoadComplete = false;
let messageList = [];
let lastMessageTimestamp = 0;

$w.onReady(async () => {
    const chatID = "myDynamicChatID";
    const senderID = currentUser.id;

    // Start listening for messages in the backend for the current chatID
    await startListeningForMessages(chatID);

    if (!initialLoadComplete) {
        await loadPreviousMessages(chatID);
        initialLoadComplete = true;
    }

    // Subscribe to real-time updates for this chat ID
    const channel = { name: `chatMessages_${chatID}` };
    subscribe(channel, (message) => {
        const { payload } = message;
        const { sender, message: messageText, timestamp } = payload;

        if (sender && messageText && timestamp > lastMessageTimestamp) {
            lastMessageTimestamp = timestamp;

            messageList.push({ sender, messageText });
            renderMessages();
        } else {
            console.warn("Duplicate or incomplete message data:", payload);
        }
    });

    $w("#sendButton").onClick(async () => {
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
    });
});

async function loadPreviousMessages(chatID) {
    try {
        const messages = await getChatMessages(chatID);
        messages.forEach((message) => {
            messageList.push({ sender: message.sender, messageText: message.message });
            lastMessageTimestamp = Math.max(lastMessageTimestamp, message.timestamp);
        });
        renderMessages();
    } catch (error) {
        console.error("Error loading previous messages:", error);
    }
}

function renderMessages() {
    const allMessagesText = messageList.map(({ sender, messageText }) => {
        return `${sender.substring(0, 10)}: ${messageText}`;
    }).join('\n');

    $w("#textBoxChat").value = allMessagesText;
}