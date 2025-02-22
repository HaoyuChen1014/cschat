$(document).ready(function () {
    // initialize variables
    myinfo = JSON.parse(localStorage.getItem('info'));
    mykey = deserializeRSAKey(localStorage.getItem('key'));
    myPublicKey = cryptico.publicKeyString(mykey);
    $.post("/api/getfriend.php").then(function (response) {
        friends = JSON.parse(response);
        friendsArr = $.map(JSON.parse(response), function (_) { return _ });
        friendsArr.sort(timedescend).forEach(function (friend) {
            showChatCard(friend);
        });
        friends
    })
    $("#myAvatarSm").empty();
    $("#myAvatarSm").append(getAvatarHtml(myinfo));
    currentUser = -1;
    currentRelation = -1;
    currentPublicKey = "";
    currentLastMessageId = 0;
    getNewMessageIntervalId = 0;
});

function timeascend(x, y) {
    return x["time"] - y["time"];
}
function timedescend(x, y) {
    return y["time"] - x["time"];
}

function nameascend(x, y) {
    return x["name"] - y["name"];
}

// onClick send button
$("#sendMessageButton").on("click", function (event) {
    event.preventDefault();
    sendMessage();
});

$("#myMessage").on("keydown", function (event) {
    var keyCode = event.keyCode || event.which;
    if (keyCode == 13) {
        event.preventDefault();
        sendMessage();
    }
});

function sendMessage() {
    if (currentUser == -1 || currentRelation == -1 || currentRelation == "") {
        // have not select user to chat with
        return;
    }
    var plaintext = $.trim(document.getElementById("myMessage").value);
    if (plaintext != "") {
        uploadMessage(plaintext, 1);
        $("#myMessage").val("");
        document.getElementById("myMessage").style.height = "47px";
    } else {
        return;
    }
}

function encryptMessage(plaintext) {
    var ciphertext = cryptico.encrypt(plaintext, publicKey);
    if (ciphertext.status) {
        return ciphertext.cipher;
    } else {
        alert("something goes wrong, please reload the page");
    }
}

function deserializeRSAKey(key) {
    let json = JSON.parse(key);
    let rsa = new RSAKey();
    rsa.setPrivateEx(json.n, json.e, json.d, json.p, json.q, json.dmp1, json.dmq1, json.coeff);
    return rsa;
}

function htmlNewText(text, timestamp, inner) {
    // XSS protection when display text
    text = escapeHTML(text);

    var $newMessage = $('<div"></div>');
    $newMessage.attr('class', inner ? 'message' : 'message message-out');

    // setup avatar
    var $avatar = $('<a href="#" data-bs-toggle="modal" class="avatar avatar-responsive"></a>');
    $avatar.attr('data-bs-target', inner ? "#modal-user-profile" : "#modal-profile");
    var $avatarImg = inner ? getAvatarHtml(friends[currentUser]['info']) : getAvatarHtml(myinfo);
    //$avatarImg.attr('src', inner ? "assets/img/avatars/2.jpg" : "assets/img/avatars/1.jpg");
    $avatar.append($avatarImg);
    $newMessage.append($avatar);

    var $messageInner = $('<div class="message-inner"></div>');
    var $messageBody = $('<div class="message-body"></div>');
    var $messageContent = $('<div class="message-content"></div>');
    var $messageText = $('<div class="message-text"></div');
    $messageText.append('</p>' + text + '</p>');
    $messageContent.append($messageText);
    $messageBody.append($messageContent);
    $messageInner.append($messageBody);

    var $messageFooter = $('<div class="message-footer"></div>');
    timeString = timeToString(timestamp);
    $messageFooter.append($('<span class="extra-small text-muted">' + timeString + '</span>'));
    $messageInner.append($messageFooter);


    $newMessage.append($messageInner);
    return $newMessage;
}

function timeToString(time) {
    var now = new Date();
    timeString = "";
    if (time.getFullYear() == now.getFullYear()) {
        // same year as today
        if (time.getMonth() == now.getMonth() && time.getDate() == now.getDate()) {
            // today
            // display time
            timeString = time.getHours() + ":" + time.getMinutes();
        } else {
            // not the same date as today
            // display date
            timeString = (time.getMonth() + 1) + '-' + time.getDate();
        }
    } else {
        // different year as today
        // display year and date
        timeString = time.getFullYear() + '-' + (time.getMonth() + 1) + '-' + time.getDate();
    }
    return timeString;
}

function showChatCard(friend) {
    var $card = $('<a href="#" class="card border-0 text-reset" onclick="selectContact(' + friend["info"]["uid"] + ');"></a>');
    var $cardBody = $('<div class="card-body"></div>');
    var $row = $('<div class="row gx-5"></div>');
    var $avatarCol = $('<div class="col-auto"></div>');
    var $avatar = $('<div class="avatar"></div>');
    var $avatarimg = getAvatarHtml(friend['info']);
    $avatar.append($avatarimg);
    $avatarCol.append($avatar);
    $row.append($avatarCol);

    var $infoCol = $('<div class="col"></div>');
    var $contactInfo = $('<div class="d-flex align-items-center mb-3"></div>');
    var $name = $('<h5 class="me-auto mb-0">' + getDisplayName(friend['info']) + '</h5>');
    var $time = $('<span class="text-muted extra-small ms-2 last-chat-time">' + timeToString(new Date(parseInt(friend['time']))) + '</span>')
    $contactInfo.append($name);
    $contactInfo.append($time);

    var plaintext = "[Undecryptable message]";
    if (friend['message']['type'] !== null) {
        var result = cryptico.decrypt(friend['message']['sender'], mykey);
        if (result.status == 'success') {
            // if i can decrypt sender, that means the message was sent by myself
            plaintext = "You: " + result.plaintext;
        } else {
            // otherwise this is a message that i received
            result = cryptico.decrypt(friend['message']['receiver'], mykey);
            if (result.status == 'success') {
                plaintext = result.plaintext;
            }
        }
    }else{
        plaintext = "[No message]";
    }


    var $message = $('<div class="d-flex align-items-center"> \
            <div class="line-clamp me-auto last-chat-message">'+ plaintext + ' \
            </div> \
            <div class="badge badge-circle bg-primary ms-5 unread"> \
                <span class="unread-count"></span> \
            </div> \
        </div > '
    );
    $infoCol.append($contactInfo);
    $infoCol.append($message);
    $row.append($infoCol);
    $cardBody.append($row);
    $card.append($cardBody);
    $('#chatlist').append($card);
}

function getUserInfo(userlist) {
    $.post("/api/getuserinfo.php", { "users": userlist }, function (result) {
        userinfo = JSON.parse(result);
        console.log(userinfo);
        userinfo.forEach(function (info) {
            //info["displayName"] = getDisplayName(info);
        })
    })
}

function getDisplayName(info) {
    if (info["name"] != null && info["name"] != "") {
        return info["name"];
    } else if (info["uname"] != null && info["uname"] != "") {
        return info["uname"];
    } else {
        return info["email"];
    }
}

function getAvatarHtml(info) {
    if (info["avatar"] == null) {
        $avatarHtml = $('<span class="avatar-text">' + getDisplayName(info).charAt(0) + '</span>');
    } else {
        $avatarHtml = $('<img alt="#" class="avatar-img">');
        //$avatarimg.attr('src', contactinfo['avatar']);
    }
    return $avatarHtml;
}

function escapeHTML(str) {
    return str.replace(
        /[&<>'"]/g,
        tag =>
        ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function selectContact(uid) {
    $("#main").attr("class", "main is-visible");
    if (uid == currentUser) {
        return;
    }
    currentUser = uid;
    currentRelation = friends[uid]['relationid'];
    currentPublicKey = friends[uid]['info']['publickey'];
    console.log("now chat with " + uid);
    $("#chatbox").empty();
    $("#currentContactName").text(getDisplayName(friends[uid]['info']));
    $("#currentContactAvatar").empty();
    $("#currentContactAvatar").append(getAvatarHtml(friends[uid]['info']));
    $("#currentContactAvatarSm").empty();
    $("#currentContactAvatarSm").append(getAvatarHtml(friends[uid]['info']));
    loadChatHistory(uid);
    if (getNewMessageIntervalId == 0) {
        getNewMessageIntervalId = setInterval("retrieveNewMessage()", 1000);
    }
}

function loadChatHistory(uid) {
    // this function is to load last 20 chat history when change contact
    $.post("/api/gethistory.php", { "relation": friends[uid]['relationid'] }).then(function (response) {
        var chathistory = $.map(JSON.parse(response), function (_) { return _ }) // convert JSON to array
        $("#emptyNotify").removeAttr("hidden");
        $("#emptyMessage").text("No chat history");
        chathistory.sort(timeascend).forEach(function (message) {
            decodeShowMessage(message);
        });
        document.getElementById("chatbody").scroll({ top: chatbody.scrollHeight });
    })
}

function decodeShowMessage(message) {
    $("#emptyNotify").prop("hidden", "hidden");
    var time = new Date(parseInt(message['time']));
    var plaintext = "[Undecyptable message]";
    var result = cryptico.decrypt(message['sender'], mykey);
    var inner = 0;
    currentLastMessageId = message['chatid'];
    if (result.status == 'success') {
        // if i can decrypt sender, that means the message was sent by myself
        plaintext = result.plaintext;
    } else {
        // otherwise this is a message that i received
        result = cryptico.decrypt(message['receiver'], mykey);
        if (result.status == 'success') {
            plaintext = result.plaintext;
            inner = 1;
        }
    }
    if (message['type'] == "1") {
        $("#chatbox").append(htmlNewText(plaintext, time, inner));
    }
}

function getPreviousChatHistory(uid, count) {
    // this is for when user scroll to the top, load previous chat history
}

function uploadMessage(plaintext, type) {
    currentPublicKey
    currentRelation

    var sender = "";
    var receiver = "";
    var senderresult = cryptico.encrypt(plaintext, myPublicKey);
    var receiverresult = cryptico.encrypt(plaintext, currentPublicKey);
    if (senderresult.status == 'success' && receiverresult.status == 'success') {
        console.log("encrypt success");
        sender = senderresult.cipher;
        receiver = receiverresult.cipher;

        $.post("/api/send.php", { "relation": currentRelation, "type": type, "sender": sender, "receiver": receiver }).then(function (response) {
            var sendresult = JSON.parse(response);
            if (sendresult['status'] == 'success') {
                currentLastMessageId = sendresult['id']
                console.log("send success");
                $("#chatbox").append(htmlNewText(plaintext, new Date(), 0));
                document.getElementById("chatbody").scroll({ top: chatbody.scrollHeight, behavior: 'smooth' });
            }
        })
    } else {
        alert("Something goes wrong, please reload the page.")
    }
}

function retrieveNewMessage() {
    // this function is to load last 20 chat history when change contact
    $.post("/api/getnewmessage.php", { "relation": friends[currentUser]['relationid'], "lastmessage": currentLastMessageId }).then(function (response) {
        var chathistory = $.map(JSON.parse(response), function (_) { return _ }) // convert JSON to array and sort, incase there are multiple messages received
        chathistory.sort(timeascend).forEach(function (message) {
            // new message received
            decodeShowMessage(message);
            document.getElementById("chatbody").scroll({ top: chatbody.scrollHeight, behavior: 'smooth' });
        });
    })
}
////////////////////////////////////////////////////////////////////////
// test only functions

function encryptMessage(plaintext, publicKey) {
    var result = cryptico.encrypt(plaintext, publicKey);
    if (result.status == 'success') {
        console.log(result.cipher);
    } else {
        console.log("failed to encrypt");
    }
}

function decryptMessage(cipher) {
    var result = cryptico.decrypt(cipher, mykey);

}