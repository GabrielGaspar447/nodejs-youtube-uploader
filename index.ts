// IMPORTS
import 'dotenv/config';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import readline from 'readline';
import { google } from 'googleapis';
import { Credentials, OAuth2Client } from 'google-auth-library';

// GLOBAL CONSTS
const SCOPES = ['https://www.googleapis.com/auth/youtube'];
const TOKEN_PATH = './client_oauth_token.json';
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const CLIENT_ID = process.env.CLIENT_ID;

// FUNCTIONS DECLARATIONS
async function ask(question: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise<string>(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function getVideosPathsAndTitles(module: string) {
  const videos = await fs.readdir('./videos');
  return videos.map((video) => {
    const titleWithoutExt = video.split('.')[0]

    return { 
      path: `./videos/${video}`,
      title: titleWithoutExt.startsWith('0') ?
        `${module}.${titleWithoutExt.slice(1)}`
        : `${module}.${titleWithoutExt}`
    }
  });
}

async function uploadVideo(auth: OAuth2Client) {
  const youtube = google.youtube('v3');

  const module = await ask('Enter the module number: ');

  if (!parseInt(module)) return console.log('Module number must be a number');

  const videos = await getVideosPathsAndTitles(module);

  for (const { path, title } of videos) {
    const videoFilePath = path;
    const videoTitle = title;
    const videoStatus = 'private';
    const madeForKids = false

    const uploadResponse = await youtube.videos.insert({
      auth: auth,
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: videoTitle
        },
        status: {
          privacyStatus: videoStatus,
          selfDeclaredMadeForKids: madeForKids
        }
      },
      media: {
        body: createReadStream(videoFilePath)
      }
    });

    await youtube.playlistItems.insert({
      auth: auth,
      part: ['snippet'],
      requestBody: {
        snippet: {
          playlistId: 'PLdtGNlVLXoTHxrSmpj1ZROlCJF1-_qa3G',
          resourceId: {
            kind: 'youtube#video',
            videoId: uploadResponse.data.id
          }
        }
      }
    });

    console.log(`Video ${videoTitle} uploaded`);
  }
}

async function storeToken(token: Credentials) {
  try {
    await fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to', TOKEN_PATH);
  } catch (err) {
    console.error(err);
  }
}

async function getNewToken(oauth2Client: OAuth2Client, callback: Function) {
  const authUrl = oauth2Client.generateAuthUrl({ scope: SCOPES });

  console.log('Authorize this app by visiting this url: ', authUrl);

  const code = await ask('Enter the code from that page here: ');

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.credentials = tokens;
    storeToken(tokens);
    return callback(oauth2Client);
  } catch (err) {
    console.log('Error while trying to retrieve access token', err);
    return;
  }
}

async function authorize(callback: Function) {
  const OAuth2 = google.auth.OAuth2;
  const oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, 'http://localhost');

  const token = await fs.readFile(TOKEN_PATH, 'utf8').catch(() => null);

  if (!token) return getNewToken(oauth2Client, callback);

  oauth2Client.credentials = JSON.parse(token);
  return callback(oauth2Client);
}

// FUNCTIONS CALLS
authorize(uploadVideo);