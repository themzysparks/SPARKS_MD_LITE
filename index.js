/*
//══════════════════════════════════════════════════════════════════════════════════════════════════════//
//                                                                                                      //
//                              ＭＹ ＷＨＡＴＳＡＰＰ ＢＯＴ－ＭＤ                                             // 
//                                                                                                      // 
//                                         Ｖ：１．０                                                    // 
//                                                                                                      // 
//                                                                                                      //
//         ░██████╗██████╗░░█████╗░██████╗░██╗░░██╗░██████╗                                             //
//        ██╔════╝██╔══██╗██╔══██╗██╔══██╗██║░██╔╝██╔════╝                                             //
//        ╚█████╗░██████╔╝███████║██████╔╝█████═╝░╚█████╗░                                             //
//        ░╚═══██╗██╔═══╝░██╔══██║██╔══██╗██╔═██╗░░╚═══██╗                                             //
//        ██████╔╝██║░░░░░██║░░██║██║░░██║██║░╚██╗██████╔╝                                             //
//        ╚═════╝░╚═╝░░░░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚═╝╚═════╝░                                             //
//                                                                                                      //
//                                                                                                      //
//                                                                                                      //
//                                                                                                      //
//                                                                                                      //
//                                                                                                      //
//══════════════════════════════════════════════════════════════════════════════════════════════════════//

*
   * @project_name : SPARKS_MD_LITE
   * @author : SPARKS
   * @youtube : https://youtube.com/@cyberwithsparks
   * @instagram : https://www.instagram.com/sparksthemzy
   * @description : My private build made public for everyone to use with easy hosting.
   * @version : 1.0
   * Donation : https://paystack.com/pay/sparks_md_donation

   * I update my GitHub bots when I have time, focusing mainly on key projects.
*
   * Licensed under the GPL-3.0 License;
* 
   * Created By SPARKS.
   * © 2025 SPARKS TECH SOLUTIONS.
*/



//══════════════════════════════════════════════════════════════════════════════════════════════════════//




require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, Browsers, MessageType, MessageOptions, Mimetype, GroupSettingChange, WAMessageProto, downloadContentFromMessage, DisconnectReason, fetchLatestBaileysVersion, proto, makeInMemoryStore } = require("maher-zubair-baileys");

// Retrieve the Base64-encoded session ID from the environment variable
const base64SessionId = process.env.SESSION_ID;

if (!base64SessionId) {
  console.error("Error: SESSION_ID is not set in the .env file!");
  process.exit(1);
}

// Function to remove files except for creds.json
function removeFiles() {
  const directoryPath = './temp/session_id'; // Adjust this to the folder where pre-keys and sender keys are stored
  const excludedFile = 'creds.json';

  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return;
    }

    files.forEach((file) => {
      if (file !== excludedFile) {
        const filePath = path.join(directoryPath, file);
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error('Error removing file:', err);
          }
        });
      }
    });
  });
}

async function restoreSession() {
  try {
    // Decode the Base64 session ID
    const decodedData = Buffer.from(base64SessionId, 'base64').toString('utf8');

    // Define the session folder path
    const sessionFolder = './temp/session_id'; // Adjust the path if needed

    // Check if the session folder exists, and if so, skip session creation
    if (!fs.existsSync(sessionFolder)) {
      fs.mkdirSync(sessionFolder, { recursive: true });
      // Write the decoded session data to creds.json
      const credsPath = path.join(sessionFolder, 'creds.json');
      fs.writeFileSync(credsPath, decodedData);
      console.log(`Session restored to ${credsPath}`);
    }
removeFiles();
    // Initialize the WhatsApp client with the session
    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    
    // Create a message store for caching messages
    const store = makeInMemoryStore({ logger: pino({ level: 'info' }) });
    store.readFromFile('./baileys_store.json');
    setInterval(() => {
      store.writeToFile('./baileys_store.json');
    }, 10_000);

    // Define the `getMessage` function to fetch messages from the store
    async function getMessage(key) {
      if (store) {
        const msg = await store.loadMessage(key.remoteJid, key.id);
        return msg?.message || undefined;
      }
      return proto.Message.fromObject({});
    }

 

    const client = makeWASocket({
      auth: state,
      logger: pino({ level: 'fatal' }), // Limit logging to fatal errors only
      //browser: Browsers.macOS("Safari"), // Customize browser name if needed
      getMessage,
      syncFullHistory: false, // Disable syncing full history
    });

    // Save updated credentials
    client.ev.on('creds.update', saveCreds);

    // Bind the store to the client for message management
    store.bind(client.ev);

    // Listen for connection updates
    client.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'open') {
        console.log('Reconnected successfully!');

        // Send a confirmation message to the bot's main user
        await sendWelcomeMessage(client);
      } else if (connection === 'close') {
        console.error('Connection closed:', lastDisconnect?.error);
      }
    });

    // Listen for messages to detect commands
    client.ev.on('messages.upsert', async (message) => {
      const msg = message.messages[0];
      if (msg.key.fromMe && !msg.broadcast) {
        // If the message failed, attempt to retry sending it
        if (msg.status === 'failed') {
          console.log('Message failed, retrying...');
          try {
            // Fetch the message from the store
            const messageContent = await getMessage(msg.key);
            if (messageContent) {
              // Resend the message if retrieved successfully
              await client.sendMessage(msg.key.remoteJid, messageContent);
              console.log('Message retried successfully!');
            } else {
              console.log('Failed to retrieve message from store.');
            }
          } catch (error) {
            console.error('Error while retrying message:', error);
          }
        }

        // Handle other commands
        await Promise.all([
          handleAutotagCommand(client, msg),
          handleBotMessage(client, msg),
          handleBotMessage2(client, msg),
        ]);
      }
    });


    console.log("WhatsApp bot is ready and reconnected!");
  } catch (error) {
    console.error("Error restoring session:", error);
  }
}

// Function to send a confirmation message to the bot's main user
async function sendWelcomeMessage(client) {
  try {
    const mainUserId = client.user.id; // Get the main user's ID
    const welcomeMessage = `*_💥 Reconnected to SPARKS_MD_LITE 💥_*
*_✨ Your Bot is Now Online! ✨_*
______________________________________
╔════◇
║ *🌟 Welcome Back! 🌟* 
║ _Your bot has been successfully reconnected to WhatsApp._
╚══════════════════════╝
╔═════◇
║ 『••• Visit for Help •••』
║❒ *YouTube:* https://youtube.com/@cyberwithsparks
║❒ *Owner:* https://wa.me/2349130815781
║❒ *Repo:* https://github.com/themzysparks/SPARKS_MD
║❒ *WaGroup:* https://chat.whatsapp.com/EePxh541Upt4DVWgDG5qYp
║❒ *Donation:* https://paystack.com/pay/sparks_md_donation
║❒ *Plugins:* https://github.com/themzysparks/SPARKS_MD
╚══════════════════════╝ 
_____________________________________
_🌟 Don't Forget to Star My Repo! 🌟_`;

    await client.sendMessage(mainUserId, { text: welcomeMessage });
    console.log('Welcome message sent to the main user!');
  } catch (error) {
    console.error('Error sending welcome message:', error);
  }
}

// // Function to handle the autotag command
// const fs = require('fs');
// const path = require('path');

// Function to read groups from the JSON file
function readGroups() {
    const filePath = path.resolve('groups.json');
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    }
    return {}; // Return an empty object if the file doesn't exist
}

// Function to save groups to the JSON file
function saveGroups(groups) {
    const filePath = path.resolve('groups.json');
    fs.writeFileSync(filePath, JSON.stringify(groups, null, 2));
}

async function handleAutotagCommand(client, message) {
    const prefix = process.env.PREFIX || '#';

    if (message.key.fromMe) {
        let messageContent;

        if (message.message && message.message.conversation) {
            messageContent = message.message.conversation;
        } else if (message.message && message.message.extendedTextMessage && message.message.extendedTextMessage.text) {
            messageContent = message.message.extendedTextMessage.text;
        }

        if (messageContent && messageContent.startsWith(prefix)) {
            const command = messageContent.slice(prefix.length).trim().toLowerCase();
            const args = command.split(/\s+/);

            if (args[0] === 'autotag') {
                // Check if the message is from a group chat
                const groupJid = message.key.remoteJid;

                if (!groupJid.endsWith('@g.us')) {
                    const replyMessage = `❗ *Warning: This command is for group chats only!*

*SPARKS_MD* 💥 `;
                    await client.sendMessage(message.key.remoteJid, {
                        text: replyMessage,
                        quoted: message,
                    });
                    return;
                }

                const action = args[1];
                const groups = readGroups(); // Read the current groups from the JSON file

                if (action === 'on') {
                    // Check if the group JID is already in the groups file
                    const groupNames = Object.values(groups);
                    if (groupNames.includes(groupJid)) {
                        await client.sendMessage(groupJid, {
                            text: `❗ *Autotag is already enabled for this group!*

*SPARKS_MD* 💥`,
                            quoted: message,
                        });
                        return;
                    }

                    // Add the group with a new name (e.g., GROUP1, GROUP2, etc.)
                    const groupName = `GROUP${Object.keys(groups).length + 1}`;
                    groups[groupName] = groupJid;
                    saveGroups(groups); // Save the updated groups to the JSON file

                    await client.sendMessage(groupJid, {
                        text: `✅ *Autotag enabled for this group!*

*SPARKS_MD* 💥`,
                        quoted: message,
                    });
                } else if (action === 'off') {
                    // Check if the group is enabled
                    const groupName = Object.keys(groups).find(name => groups[name] === groupJid);
                    if (!groupName) {
                        await client.sendMessage(groupJid, {
                            text: `❗ *Autotag is not enabled for this group!*

*SPARKS_MD* 💥`,
                            quoted: message,
                        });
                        return;
                    }

                    // Remove the group from the list
                    delete groups[groupName];
                    saveGroups(groups); // Save the updated groups to the JSON file

                    await client.sendMessage(groupJid, {
                        text: `✅ *Autotag disabled for this group!*

*SPARKS_MD* 💥`,
                        quoted: message,
                    });
                } else {
                    // Incorrect usage
                    const usageMessage = `❗ *Incorrect usage!*

*Sample Usage:*
\`${prefix}autotag on\` - Enable autotag for this group.
\`${prefix}autotag off\` - Disable autotag for this group.

*SPARKS_MD* 💥`;
                    await client.sendMessage(groupJid, {
                        text: usageMessage,
                        quoted: message,
                    });
                }
            }
        }
    }
}




// Function to read groups from the JSON file
function readGroups() {
    const filePath = path.resolve('groups.json');
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    }
    return {}; // Return an empty object if the file doesn't exist
}

// Function to save groups to the JSON file
function saveGroups(groups) {
    const filePath = path.resolve('groups.json');
    fs.writeFileSync(filePath, JSON.stringify(groups, null, 2));
}




async function handleBotMessage(client, message) {
    try {
        // Check if the message is sent by the bot itself (ignore messages from others)
        if (!message.key.fromMe) return;
        if (message.broadcast) return;

        const botNumber = process.env.BOT_NUMBER;
        const prefix = process.env.PREFIX || '#';
        const botPersonalJid = `${botNumber}@s.whatsapp.net`; // Replace with your bot's personal chat JID
        if (message.key.remoteJid !== botPersonalJid) return;

        // Extract the command and group name from the message
        let messageContent = null;
        if (message.message.conversation) {
            messageContent = message.message.conversation;
        } else if (message.message.extendedTextMessage) {
            messageContent = message.message.extendedTextMessage.text;
        }
        if (!messageContent) return;

        // Convert to lowercase and check for the command
        if (messageContent.slice(prefix.length).trim().toLowerCase().startsWith('autotagu')) {
            const args = messageContent.slice(prefix.length + 8).trim().split(/\s+/); // Remove prefix + 'AUTOTAGU'
            const groupName = args[0];

            // Read the groups from the JSON file
            const groups = readGroups();
            const groupJid = groups[groupName];
            if (!groupJid) {
                await client.sendMessage(botPersonalJid, {
                    text: `❗ *Group name '${groupName}' not found in the list of saved groups!*`,
                    quoted: message,
                });
                return;
            }

            // Check if the message has a reply
            if (
                !message.message.extendedTextMessage ||
                !message.message.extendedTextMessage.contextInfo ||
                !message.message.extendedTextMessage.contextInfo.quotedMessage
            ) {
                await client.sendMessage(botPersonalJid, {
                    text: '❗ *You need to reply to a message to use this command!*',
                    quoted: message,
                });
                return;
            }

            const quotedMessage = message.message.extendedTextMessage.contextInfo.quotedMessage;

            // Fetch group participants
            const groupMetadata = await client.groupMetadata(groupJid);
            const participants = groupMetadata.participants.map(participant => participant.id);
            const downloadLimit = parseInt(process.env.DOWNLOAD_LIMIT) || 10; // Default download limit is 10
            // File size limit in bytes (e.g., 10 MB)
            const fileSizeLimit =  downloadLimit * 1024 * 1024; // 10 MB

            // Handle different message types
            if (quotedMessage.imageMessage || quotedMessage.videoMessage || quotedMessage.audioMessage || quotedMessage.documentMessage || quotedMessage.stickerMessage) {
                const mediaType = Object.keys(quotedMessage)[0]; // Get the media type
                const mediaMessage = quotedMessage[mediaType];

                // Check the file size
                const fileSize = mediaMessage.fileLength || 0;
                if (fileSize > fileSizeLimit) {
                    await client.sendMessage(botPersonalJid, {
                        text: `❗ *The file size (${(fileSize / (1024 * 1024)).toFixed(2)} MB) exceeds the limit of ${(fileSizeLimit / (1024 * 1024)).toFixed(2)} MB. Skipping this file.*`,
                        quoted: message,
                    });
                    return;
                }

                // Download the media
                const stream = await downloadContentFromMessage(mediaMessage, mediaType.replace('Message', ''));
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                // Send the media
                const mediaOptions = {
                    [mediaType.replace('Message', '')]: buffer,
                    caption: mediaMessage.caption || '',
                    mimetype: mediaMessage.mimetype,
                    fileName: mediaMessage.fileName || undefined,
                    mentions: participants,
                };
                await client.sendMessage(groupJid, mediaOptions);
            } else if (quotedMessage.conversation) {
                await client.sendMessage(groupJid, {
                    text: quotedMessage.conversation,
                    mentions: participants,
                });
            } else if (quotedMessage.extendedTextMessage) {
                await client.sendMessage(groupJid, {
                    text: quotedMessage.extendedTextMessage.text,
                    mentions: participants,
                });
            }

            console.log(`Message sent to ${groupName} with tags.`);
        }
    } catch (error) {
        console.error('Error in handleBotMessage:', error);
    }
}



async function handleBotMessage2(client, message) {
    try {
        if (!message.key.fromMe) return; // Ignore messages not sent by the bot itself
        if (message.broadcast) return;

        const botNumber = process.env.BOT_NUMBER;
        const prefix = process.env.PREFIX || '#';
        const botPersonalJid = `${botNumber}@s.whatsapp.net`;

        if (message.key.remoteJid !== botPersonalJid) return;

        let messageContent = null;
        if (message.message.conversation) {
            messageContent = message.message.conversation;
        } else if (message.message.extendedTextMessage) {
            messageContent = message.message.extendedTextMessage.text;
        }
        if (!messageContent) return;

        // Handle "fetch" command
        if (messageContent.slice(prefix.length).trim().toLowerCase() === 'fetch') {
            // Load groups from JSON file
            const groups = JSON.parse(fs.readFileSync('groups.json', 'utf8'));

            if (!groups || Object.keys(groups).length === 0) {
                await client.sendMessage(botPersonalJid, {
                    text: '❗ *No groups found in the saved list!*',
                    quoted: message,
                });
                return;
            }

            let groupDetails = '*📂 Saved Groups:*\n\n';
            for (const [name, jid] of Object.entries(groups)) {
                try {
                    // Fetch group metadata to get the group name
                    const metadata = await client.groupMetadata(jid);
                    const groupName = metadata.subject;

                    groupDetails += `🔹 *${groupName}*\n  - Group Name: ${name}\n  - JID: ${jid}\n\n`;
                } catch (err) {
                    console.error(`Error fetching metadata for group JID ${jid}:`, err);
                    groupDetails += `🔹 *Unknown Group*\n  - Group Name: ${name}\n  - JID: ${jid}\n\n`;
                }
            }

            // Send the list of groups
            await client.sendMessage(botPersonalJid, {
                text: groupDetails.trim(),
                quoted: message,
            });
        }
    } catch (error) {
        console.error('Error in handleBotMessage:', error);
    }
}



//   const prefix = process.env.PREFIX;
//   console.log("Prefix used:", prefix);

//   // Ensure message and body exist
//   if (!message.body) {
//     console.log('Message does not contain body, skipping...');
//     return;
//   }

//   console.log("Received message:", message.body);

//   // Check if the message starts with the prefix and contains the 'autotag' command
//   if (message.body.startsWith(prefix) && message.body.slice(prefix.length).trim().toLowerCase() === 'autotag') {
//     // Check if the message is from a group
//     console.log("Is group:", message.isGroup);

//     if (!message.isGroup) {
//       // Send a warning if not from a group
//       const warningMessage = `
// ❗ *Warning: This command is for group chats only!*

// *SPARKS_MD* 💥
//       `;
//       await client.sendMessage(message.key.remoteJid, { text: warningMessage });
//       return;
//     }

//     // Check if AUTOTAG_GJIDS exists in the .env file
//     const envFilePath = path.resolve('.env');
//     const envContent = fs.readFileSync(envFilePath, 'utf-8');
//     const regex = /^AUTOTAG_GJIDS=(.*)$/m;
//     const groupJid = message.key.remoteJid;
//     console.log("Group JID:", groupJid);

//     if (regex.test(envContent)) {
//       // If AUTOTAG_GJIDS exists, append the JID
//       const updatedEnvContent = envContent.replace(regex, (match, gjids) => {
//         return `AUTOTAG_GJIDS=${gjids},${groupJid}`;
//       });
//       fs.writeFileSync(envFilePath, updatedEnvContent);
//     } else {
//       // If AUTOTAG_GJIDS doesn't exist, create it with the current JID
//       fs.appendFileSync(envFilePath, `AUTOTAG_GJIDS=${groupJid}\n`);
//     }

//     // Send confirmation message to the group
//     const confirmationMessage = `
// ✅ *Autotag enabled for this group!*

// *SPARKS_MD* 💥
//     `;
//     await client.sendMessage(groupJid, { text: confirmationMessage });
//   }
// }

// Call the function to restore and reconnect the session
restoreSession();
