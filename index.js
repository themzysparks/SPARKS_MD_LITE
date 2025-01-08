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
const {Boom} = require('@hapi/boom');
const NodeCache = require('node-cache');
const path = require('path');
const makeWASocket = require('@whiskeysockets/baileys').default;
const {AnyMessageContent, BinaryInfo, delay, DisconnectReason, downloadAndProcessHistorySyncNotification, encodeWAM, fetchLatestBaileysVersion, getAggregateVotesInPollMessage, getHistoryMsg, isJidNewsletter, makeCacheableSignalKeyStore, makeInMemoryStore, proto, useMultiFileAuthState, WAMessageContent, WAMessageKey} = require('@whiskeysockets/baileys');
// (async () => {
//     const open = await import('open');
//     // Now you can use `open` as you would in an ES module
// })();

const fs = require('fs');
const P = require('pino');

const logger = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` }, P.destination('./wa-logs.txt'))
logger.level = 'trace'

const useStore = !process.argv.includes('--no-store')
const doReplies = process.argv.includes('--do-reply')
const usePairingCode = process.argv.includes('--use-pairing-code')

// Retrieve the Base64-encoded session ID from the environment variable
const base64SessionId = process.env.SESSION_ID;

if (!base64SessionId) {
  console.error("Error: SESSION_ID is not set in the .env file!");
  process.exit(1);
}

// external map to store retry counts of messages when decryption/encryption fails
// keep this out of the socket itself, so as to prevent a message decryption/encryption loop across socket restarts
const msgRetryCounterCache = new NodeCache()

const onDemandMap = new Map();


// the store maintains the data of the WA connection in memory
// can be written out to a file & read from it
const store = useStore ? makeInMemoryStore({ logger }) : undefined
store?.readFromFile('./baileys_store_multi.json')
// save every 10s
setInterval(() => {
    store?.writeToFile('./baileys_store_multi.json')
}, 10_000)

const startSock = async () => {
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
  
  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder)
  // fetch latest version of WA Web
  const { version, isLatest } = await fetchLatestBaileysVersion()
  console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

  const sock = makeWASocket({
      version,
      logger,
      auth: {
          creds: state.creds,
          /** caching makes the store faster to send/recv messages */
          keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      msgRetryCounterCache,
      generateHighQualityLinkPreview: true,
      // ignore all broadcast messages -- to receive the same
      // comment the line below out
      // shouldIgnoreJid: jid => isJidBroadcast(jid),
      // implement to handle retries & poll updates
      getMessage,
  });

  store?.bind(sock.ev)

sock.ev.process(
async(events) => {
  // something about the connection changed
  // maybe it closed, or we received all offline message or connection opened
  if(events['connection.update']) {
      const update = events['connection.update']
      const { connection, lastDisconnect } = update
    if (connection === 'close') {
        // reconnect if not logged out
        if (lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut) {
            startSock();
        } else {
            console.log('Connection closed. You are logged out.');
        }
    }


      // WARNING: THIS WILL SEND A WAM EXAMPLE AND THIS IS A ****CAPTURED MESSAGE.****
      // DO NOT ACTUALLY ENABLE THIS UNLESS YOU MODIFIED THE FILE.JSON!!!!!
      // THE ANALYTICS IN THE FILE ARE OLD. DO NOT USE THEM.
      // YOUR APP SHOULD HAVE GLOBALS AND ANALYTICS ACCURATE TO TIME, DATE AND THE SESSION
      // THIS FILE.JSON APPROACH IS JUST AN APPROACH I USED, BE FREE TO DO THIS IN ANOTHER WAY.
      // THE FIRST EVENT CONTAINS THE CONSTANT GLOBALS, EXCEPT THE seqenceNumber(in the event) and commitTime
      // THIS INCLUDES STUFF LIKE ocVersion WHICH IS CRUCIAL FOR THE PREVENTION OF THE WARNING
      const sendWAMExample = false;
      if(connection === 'open' && sendWAMExample) {
          /// sending WAM EXAMPLE
          const {
              header: {
                  wamVersion,
                  eventSequenceNumber,
              },
              events,
          } = JSON.parse(await fs.promises.readFile("./boot_analytics_test.json", "utf-8"))

          const binaryInfo = new BinaryInfo({
              protocolVersion: wamVersion,
              sequence: eventSequenceNumber,
              events: events
          })

          const buffer = encodeWAM(binaryInfo);

          const result = await sock.sendWAMBuffer(buffer)
          console.log(result)
          // Send a confirmation message to the bot's main user
          
      }
if (connection === 'open') {
    await sendWelcomeMessage(sock);
}
      console.log('connection update', update)
  }

  // credentials updated -- save them
  if(events['creds.update']) {
      await saveCreds()
  }

  if(events['labels.association']) {
   // console.log(events['labels.association'])
  }


  if(events['labels.edit']) {
    // console.log(events['labels.edit'])
  }

  if(events.call) {
    //console.log('recv call event', events.call)
  }
  // history received
  if(events['messaging-history.set']) {
      const { chats, contacts, messages, isLatest, progress, syncType } = events['messaging-history.set']
      if (syncType === proto.HistorySync.HistorySyncType.ON_DEMAND) {
          //console.log('received on-demand history sync, messages=', messages)
      }
      //console.log(`recv ${chats.length} chats, ${contacts.length} contacts, ${messages.length} msgs (is latest: ${isLatest}, progress: ${progress}%), type: ${syncType}`)
  }

  // received a new message
  if(events['messages.upsert']) {
      const upsert = events['messages.upsert']
      //console.log('recv messages ', JSON.stringify(upsert, undefined, 2))

      if(upsert.type === 'notify') {
          for (const msg of upsert.messages) {
            if(msg.key.fromMe && msg.key.remoteJid != 'status@broadcast'){
                // Handle other commands
                await Promise.all([
                  handleAutotagCommand(sock, msg),
                  //handleBotMessage(sock, msg),
                  //handleBotMessage2(sock, msg),
                ]);
                
                
                console.log(msg)
              //console.log(msg.message)
              //console.log(msg)
             //  //console.log(msg.message.extendedTextMessage)
             //  console.log(msg.message.extendedTextMessage.text)
             // // console.log(msg.message.extendedTextMessage.contextInfo)
             //  //console.log(msg.message.extendedTextMessage.contextInfo.quotedMessage)
             //  console.log(msg.message.extendedTextMessage.contextInfo.quotedMessage.conversation)
             //  //console.log(msg.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage)
             //  console.log(msg.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage.text)
             // // console.log(msg.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage.contextInfo)
             //  console.log(msg.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage.contextInfo.quotedMessage)
            }
            
            
            
            
            
            // if (msg.key.remoteJid === 'status@broadcast') 
              


            // if (!msg.key.fromMe && doReplies && !isJidNewsletter(msg.key?.remoteJid)) {
            //    // console.log('replying to', msg.key.remoteJid);
            //     await sock.readMessages([msg.key]);
            //     await sendMessageWTyping({ text: 'Hello there!' }, msg.key.remoteJid);
            // }

          }
      }
  }

  // messages updated like status delivered, message deleted etc.
  if(events['messages.update']) {
      //console.log(
      //    JSON.stringify(events['messages.update'], undefined, 2)
     // )

      for(const { key, update } of events['messages.update']) {
          if(update.pollUpdates) {
              const pollCreation = await getMessage(key)
              if(pollCreation) {
                  // console.log(
                  //     'got poll update, aggregation: ',
                  //     getAggregateVotesInPollMessage({
                  //         message: pollCreation,
                  //         pollUpdates: update.pollUpdates,
                  //     })
                  // )
              }
          }
      }
  }

  if(events['message-receipt.update']) {
     //// //console.log(events['message-receipt.update'])
  }

  if(events['messages.reaction']) {
     // console.log(events['messages.reaction'])
  }

  if(events['presence.update']) {
     // console.log(events['presence.update'])
  }

  if(events['chats.update']) {
      //console.log(events['chats.update'])
  }

  if(events['contacts.update']) {
    for(const contact of events['contacts.update']) {
      if (typeof contact.imgUrl !== 'undefined') {
          const newUrl = contact.imgUrl === null
              ? null
              : await sock.profilePictureUrl(contact.id).catch(() => null);
          // console.log(
          //     `contact ${contact.id} has a new profile pic: ${newUrl}`,
          // );
      }

    }
  }

  if(events['chats.delete']) {
   // console.log('chats deleted ', events['chats.delete'])
  }

  
  //////////////
}
)
return sock


  
  async function getMessage(key) {
      if (store) {
          const msg = await store.loadMessage(key.remoteJid, key.id);
          return msg?.message || undefined;
      }

      // Handle case where store is not available (return undefined or some fallback)
      return undefined;
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

async function sendWelcomeMessage(client) {
  try {
      const botPrefix = process.env.BOT_PREFIX || '#';
    const mainUserId = client.user.id; // Get the main user's ID
    const welcomeMessage = `*_💥 Connected to SPARKS_MD_LITE 💥_*
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
_🌟 Don't Forget to Star My Repo! 🌟_
*════════════════════════════════════*
❒ *BOT PREFIX:* ${botPrefix}
❒ *BOT NUMBER:* ${mainUserId.split('@')[0]}`;

    await client.sendMessage(mainUserId, { text: welcomeMessage });
    console.log('Welcome message sent to the main user!');
  } catch (error) {
    console.error('Error sending welcome message:', error);
  }
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


startSock();
