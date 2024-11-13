import { sendMessage, getChatMessages, startListeningForMessages } from 'backend/chatapp.jsw';
import { subscribe } from 'wix-realtime';
import { currentUser } from 'wix-users';
import wixWindow from 'wix-window';

let initialLoadComplete = false;
let messageList = [];
let lastMessageTimestamp = 0;

$w.onReady(async () => {
    const chatID = "myDynamicChatID"; // In the future, dynamically generate this
    const senderID = currentUser.id;

    $w("#repeaterChat").data = []

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

            // Push the message with a unique _id directly to messageList
            messageList.push({
                _id: `${timestamp}-${messageList.length}`,
                sender,
                messageText,
                timestamp
            });

            updateRepeaterMessages();
        } else {
            console.warn("Duplicate or incomplete message data:", payload);
        }
    });

    // Send message on click
    $w("#buttonSendMessage").onClick(() => sendMessageHandler(chatID, senderID));

    // Send message on pressing Enter key
    $w("#inputUserMessage").onKeyPress((event) => {
        if (event.key === "Enter") {
            sendMessageHandler(chatID, senderID);
        }
    });
});

// Send message handler
async function sendMessageHandler(chatID, senderID) {
    const messageText = $w("#inputUserMessage").value.trim();
    if (messageText) {
        try {
            await sendMessage(chatID, senderID, messageText);
            // console.log("Message sent successfully!");
            $w("#inputUserMessage").value = "";
        } catch (error) {
            console.error("Error sending message:", error);
        }
    }
}

async function loadPreviousMessages(chatID) {
    try {
        const messages = await getChatMessages(chatID);
        messages.forEach((message) => {
            messageList.push({
                _id: `${message.timestamp}-${messageList.length}`,
                sender: message.sender,
                messageText: message.message,
                timestamp: message.timestamp
            });
            lastMessageTimestamp = Math.max(lastMessageTimestamp, message.timestamp);
        });
        updateRepeaterMessages();
    } catch (error) {
        console.error("Error loading previous messages:", error);
    }
}

function updateRepeaterMessages() {
    $w("#repeaterChat").data = messageList;
    const repeaterLength = $w("#repeaterChat").data.length;

    $w("#repeaterChat").onItemReady(($item, itemData, index) => {
        const { sender, messageText, timestamp } = itemData;

        const messageTime = timestamp && !isNaN(timestamp) ?
            new Date(parseInt(timestamp)).toLocaleString('en-US', {
                hour: 'numeric',
                minute: 'numeric',
                hour12: true,
            }) :
            "Unknown Time";

        if (sender === currentUser.id) {
            // Display message in the sender box
            $item("#boxSender").expand();
            $item("#boxReceiver").collapse();
            $item("#textMessageSender").text = messageText;
            $item("#textMessageTimeSender").text = messageTime;
        } else {
            // Display message in the receiver box
            $item("#boxSender").collapse();
            $item("#boxReceiver").expand();
            $item("#textMessageReceiver").text = messageText;
            $item("#textMessageTimeReceiver").text = messageTime;
        }

        if (index === repeaterLength - 1) {
            setTimeout(() => {
                wixWindow.postMessage("scrollToChatBottom");
            }, 150);
        }
    });
}