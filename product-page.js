let sellerDetails = null;
let buyerDetails = null;


$w.onReady(function () {
    $w("#buttonMesageSellerRent").onClick(() => {
        $w("#buttonMesageSellerRent").label = "Processing..."
        $w("#buttonMesageSellerRent").disable()

        const productName = $w('#textProductName').text;
        const sellerName = $w('#textVendorName1').text;
        const message = `Hey ${sellerName}! I'd like to have a talk with you about a product you posted: ${productName}`
        setupChat(message)
            .catch((error) => {
                console.error("Setup chat error:", error);

                $w("#buttonMesageSellerRent").label = "Error Occured";
                setTimeout(() => {
                    $w("#buttonMesageSellerRent").label = "Message Seller";
                    $w("#buttonMesageSellerRent").enable();
                }, 3000);
            });
    });
});

async function setupChat(message) {
    if (!buyerDetails.userId || !sellerDetails.userId) {
        console.error("User ID missing for buyer or seller");
        return;
    }

    console.log("Found both buyer and seller details")

    const buyerUserId = buyerDetails.userId;
    const sellerUserId = sellerDetails.userId;
    const conversationID = `${buyerUserId}_${sellerUserId}`

    try {

        const existingChat = await wixData.query("ChatDetails")
            .eq("conversationID", conversationID)
            .find();

        if (existingChat.items.length === 0) {
            // Insert new conversation

            const buyerFullName = `${buyerDetails.firstName} ${buyerDetails.lastName}`
            const buyerUserName = buyerDetails.userName
            const buyerProfilePhoto = buyerDetails.profilePhoto || profilePlaceholder

            const sellerFullName = `${sellerDetails.firstName} ${sellerDetails.lastName}`
            const sellerUserName = sellerDetails.userName
            const sellerProfilePhoto = sellerDetails.profilePhoto || profilePlaceholder

            const chatDetailsObject = {
                conversationID,
                buyerUserId,
                buyerFullName,
                buyerUserName,
                buyerProfilePhoto,
                sellerUserId,
                sellerFullName,
                sellerUserName,
                sellerProfilePhoto,
                lastMessage: "",
                lastMessageSender: "",
                lastMessageTime: null,
                unreadMessages: 0,
            }

            await wixData.insert("ChatDetails", chatDetailsObject)

            console.log("New conversation created");

        } else {
            console.log("Conversation already exists");
        }

        console.log("Start conversation with convo id: " + conversationID)

        // Redirect
        if (message) {
            to(`/chat-page?conversationID=${conversationID}&message=${message}`);
        } else {
            to(`/chat-page?conversationID=${conversationID}`);
        }

    } catch (error) {
        console.error("Error creating conversation:", error);
        throw error;
    }
}