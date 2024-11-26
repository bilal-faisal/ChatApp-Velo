import { sendMessage, getChatMessages, startListeningForMessages } from 'backend/chatapp.jsw';
import { subscribe, unsubscribe } from 'wix-realtime';
import { currentUser } from 'wix-users';
import wixWindow from 'wix-window';
import wixLocation from 'wix-location';
import wixData from 'wix-data';

let senderID;
let currentConvoID = ""
let messageList = [];
let userConversations = [];
let lastMessageTimestamp = 0;
let activeChannel = null;
let activeSubscriptionId = null;
let isMessageHandlerSet = false;
let filteredConversations = [];
let subscriptionIds = {};

$w.onReady(async () => {

    $w("#repeaterChat").data = []
    $w("#repeaterConversations").data = []

    if (currentUser.loggedIn) {
        senderID = currentUser.id;
        console.log("Logged-in user's ID:", senderID);
    } else {
        console.error("User not logged in");
        wixLocation.to("/");
        return;
    }

    const queryParams = wixLocation.query;
    const conversationID = queryParams.conversationID;

    await fetchUserConversations(senderID);
    if (conversationID) {
        console.log("Conversation ID provided:", conversationID);
        await setupConversation(conversationID)
    } else {

        console.log("No conversation ID provided.");
        if (userConversations.length > 0) {
            const conversationID = userConversations[0].conversationID
            await setupConversation(conversationID)
        }
    }
    $w("#inputSearchConversations").onInput(() => {
        handleSearchConversations();
    });
});

async function setupConversation(conversationID) {
    const convo = userConversations.find((con) => con.conversationID === conversationID);
    if (!convo) {
        console.error("Invalid or missing conversation ID");
        return;
    }

    // Update the current conversation ID
    currentConvoID = conversationID;

    // Reset variables and UI
    messageList = [];
    $w("#repeaterChat").data = [];
    updateRepeaterMessages();
    lastMessageTimestamp = 0;

    if (senderID == convo.sellerUserId) {
        $w("#imageProfilePictureSelected").src = convo.buyerProfilePhoto;
        $w("#textNameSelected").text = convo.buyerFullName;
        $w("#textUserNameSelected").text = convo.buyerUserName;
    } else if (senderID == convo.buyerUserId) {
        $w("#imageProfilePictureSelected").src = convo.sellerProfilePhoto;
        $w("#textNameSelected").text = convo.sellerFullName;
        $w("#textUserNameSelected").text = convo.sellerUserName;
    }

    // Reset unread messages for the active conversation & Update the UI to hide unread messages
    convo.unreadMessages = 0;
    await wixData.update("ChatDetails", convo);
    populateConversationsUI(userConversations);

    // Start listening for messages in the backend for the current conversationID
    await startListeningForMessages(conversationID);

    // Load previous messages for the new conversation
    await loadPreviousMessages(conversationID);

    if (activeSubscriptionId) {
        await unsubscribe({ subscriptionId: activeSubscriptionId });
        console.log(`Unsubscribed from channel: ${activeChannel}`);
    }

    // Set the active channel
    activeChannel = `chatMessages_${conversationID}`;

    // Subscribe to real-time updates
    const channel = { name: activeChannel };
    await subscribe(channel, async (message) => {
        const { payload } = message;
        const { sender, message: messageText, timestamp } = payload;

        if (activeChannel === `chatMessages_${conversationID}` && sender && messageText && timestamp > lastMessageTimestamp) {
            lastMessageTimestamp = timestamp;
            messageList.push({
                _id: `${timestamp}-${messageList.length}`,
                sender,
                messageText,
                timestamp,
            });
            updateRepeaterMessages();

            // Find and update the conversation in userConversations
            const conversation = userConversations.find(convo => convo.conversationID === currentConvoID);
            if (conversation) {
                conversation.lastMessage = messageText;
                conversation.lastMessageTime = new Date(timestamp);
                conversation.lastMessageSender = sender;

                // Update the database with the updated conversation
                await wixData.update("ChatDetails", conversation);

                // Re-sort conversations and refresh the UI
                userConversations.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
                populateConversationsUI(userConversations);
            }

        } else if (activeChannel !== `chatMessages_${conversationID}`) {
            console.warn(`Message received for a different conversation: ${conversationID}`);
        } else {
            console.warn("Duplicate or incomplete message data:", payload);
        }
    })
        .then((subscriptionId) => {
            activeSubscriptionId = subscriptionId;
            console.log(`Subscribed to conversation: ${conversationID} with subscription ID: ${activeSubscriptionId}`);
        });

    setupMessageHandlers(senderID);
}

function setupMessageHandlers(senderID) {
    if (isMessageHandlerSet) {
        // Prevent adding multiple handlers
        return;
    }

    $w("#buttonSendMessage").onClick(() => sendMessageHandler(senderID));
    $w("#inputUserMessage").onKeyPress((event) => {
        if (event.key === "Enter") {
            sendMessageHandler(senderID);
        }
    });

    // Mark handlers as set
    isMessageHandlerSet = true;
}


// Send message handler
async function sendMessageHandler(senderID) {
    const messageText = $w("#inputUserMessage").value.trim();
    if (messageText) {
        try {
            if (!currentConvoID) {
                console.error("No active conversation. Message not sent.");
                return;
            }

            await sendMessage(currentConvoID, senderID, messageText);
            $w("#inputUserMessage").value = "";

            console.log("Message sent successfully!");

            // Find the conversation in userConversations
            const conversation = userConversations.find(convo => convo.conversationID === currentConvoID);
            if (!conversation) {
                console.error("Conversation not found in userConversations for ID:", currentConvoID);
                return;
            }
            conversation.lastMessage = messageText;
            conversation.lastMessageTime = new Date();
            conversation.lastMessageSender = senderID;

            // Update the database with the updated conversation
            await wixData.update("ChatDetails", conversation);


            // Re-sort conversations and refresh the UI
            userConversations.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
            populateConversationsUI(userConversations);

        } catch (error) {
            console.error("Error sending message:", error);
        }
    }
}

async function loadPreviousMessages(conversationID) {
    try {
        const messages = await getChatMessages(conversationID);
        messages.forEach((message) => {
            const isDuplicate = messageList.some((msg) => msg._id === `${message.timestamp}-${messageList.length}`);
            if (!isDuplicate) {
                messageList.push({
                    _id: `${message.timestamp}-${messageList.length}`,
                    sender: message.sender,
                    messageText: message.message,
                    timestamp: message.timestamp,
                });
                lastMessageTimestamp = Math.max(lastMessageTimestamp, message.timestamp);
            }
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

async function fetchUserConversations(userID) {
    try {
        const results = await wixData.query("ChatDetails")
            .contains("conversationID", userID)
            .descending("lastMessageTime") // Sort by lastMessageTime
            .find();

        if (results.items.length > 0) {
            console.log("Conversations for user:", results.items);

            userConversations = results.items;

            // Unsubscribe from any previous subscriptions
            for (const subscriptionId of Object.values(subscriptionIds)) {
                await unsubscribe({ subscriptionId });
            }
            subscriptionIds = {};

            // Subscribe to all conversation channels
            for (const conversation of userConversations) {
                const channel = { name: `chatMessages_${conversation.conversationID}` };
                subscribe(channel, async (message) => {
                    const { payload } = message;
                    const { sender, message: messageText, timestamp } = payload;

                    // Update the conversation in the array
                    const convoToUpdate = userConversations.find(
                        (convo) => convo.conversationID === conversation.conversationID
                    );

                    if (convoToUpdate) {
                        convoToUpdate.lastMessage = messageText;
                        convoToUpdate.lastMessageTime = new Date(timestamp);
                        convoToUpdate.lastMessageSender = sender;

                        // If the current conversation is not active, increment unreadMessages
                        if (convoToUpdate.conversationID !== currentConvoID) {
                            convoToUpdate.unreadMessages = (convoToUpdate.unreadMessages || 0) + 1;
                        } else {
                            convoToUpdate.unreadMessages = 0; // Reset unread messages for the active conversation
                        }
                        await wixData.update("ChatDetails", convoToUpdate);


                        // Re-sort conversations and refresh the UI
                        userConversations.sort(
                            (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
                        );
                        populateConversationsUI(userConversations);
                    }
                }).then((subscriptionId) => {
                    subscriptionIds[conversation.conversationID] = subscriptionId;
                });
            }

            // Populate conversations UI after subscription
            populateConversationsUI(userConversations);
        } else {
            console.warn("No conversations found for this user");
        }
    } catch (error) {
        console.error("Error fetching user conversations:", error);
    }
}

function populateConversationsUI(conversationList) {
    $w("#repeaterConversations").data = conversationList;

    $w("#repeaterConversations").onItemReady(($item, itemData) => {
        let participantName = "";

        if (senderID == itemData.sellerUserId) {
            $item("#imageProfilePicture").src = itemData.buyerProfilePhoto;
            $item("#textName").text = itemData.buyerFullName;
            participantName = itemData.buyerFullName.split(" ")[0];
        } else if (senderID == itemData.buyerUserId) {
            $item("#imageProfilePicture").src = itemData.sellerProfilePhoto;
            $item("#textName").text = itemData.sellerFullName;
            participantName = itemData.sellerFullName.split(" ")[0];
        }

        // Show the last message (truncate to 100 characters)
        const lastMessageDisplay =
            itemData.lastMessageSender === senderID
                ? `You: ${itemData.lastMessage}`
                : `${participantName}: ${itemData.lastMessage}`;
        $item("#textLastMessage").text = lastMessageDisplay
            ? lastMessageDisplay.substring(0, 100)
            : "";

        // Format and display the last message time
        if (itemData.lastMessageTime) {
            const lastMessageTime = new Date(itemData.lastMessageTime).toLocaleString('en-US', {
                hour: 'numeric',
                minute: 'numeric',
                hour12: true,
                month: 'short',
                day: 'numeric',
            });
            $item("#textLastMessageTime").text = lastMessageTime;
        } else {
            $item("#textLastMessageTime").text = "";
        }

        // Show the unread messages count
        if (itemData.unreadMessages > 0) {
            $item("#boxUnreadMessage").show();
            $item("#textTotalUnreadMessages").text = itemData.unreadMessages.toString();
        } else {
            $item("#boxUnreadMessage").hide();
        }

        $item("#boxConversation").onClick(async () => {
            if (itemData.conversationID !== currentConvoID) {
                messageList = [];
                $w("#repeaterChat").data = [];
                updateRepeaterMessages();
                await setupConversation(itemData.conversationID);
            }
        });
    });
}

function handleSearchConversations() {
    const searchTerm = $w("#inputSearchConversations").value.trim().toLowerCase();

    if (searchTerm) {
        // Filter conversations based on buyer or seller name
        filteredConversations = userConversations.filter((convo) => {
            const buyerName = `${convo.buyerFullName}`.toLowerCase();
            const sellerName = `${convo.sellerFullName}`.toLowerCase();
            return buyerName.includes(searchTerm) || sellerName.includes(searchTerm);
        });
    } else {
        // If search term is empty, show all conversations
        filteredConversations = userConversations;
    }

    // Update the repeater with filtered results
    populateConversationsUI(filteredConversations);
}


// $w.onReady(() => {
//     if (wixWindow.formFactor === "Mobile") {
//         $w("#vectorImage8").onClick(() => {
//             $w("#flexBox").customClassList.remove("showMessage")
//         })
//         $w("#repeater1").forEachItem(($item) => {
//             $item("#box93").onClick(() => {
//                 $w("#flexBox").customClassList.add("showMessage")
//             })
//         })
//     }
// });