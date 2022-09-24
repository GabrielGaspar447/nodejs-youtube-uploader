// IMPORTS
import 'dotenv/config';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import readline from 'readline';
import chalk from 'chalk';
import { google, youtube_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// GLOBAL CONSTS
const SCOPES = ['https://www.googleapis.com/auth/youtube'];
const TOKEN_PATH = './client_oauth_token.json';
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const CLIENT_ID = process.env.CLIENT_ID;
const PLAYLIST_ID_TO_INSERT_VIDEOS = process.env.PLAYLIST_ID_TO_INSERT_VIDEOS;
const OAUTH2 = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, 'http://localhost');

// FUNCTIONS DECLARATIONS
async function ask (question: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return await new Promise<string>(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function getAuth () {
  const cachedToken = await fs.readFile(TOKEN_PATH, 'utf8').catch(() => null);

  if (cachedToken) return OAUTH2.setCredentials(JSON.parse(cachedToken));

  const authUrl = OAUTH2.generateAuthUrl({ scope: SCOPES });

  console.log(chalk.yellowBright('\nAuthorize this app by visiting the url below:\n'));
  console.log(chalk.blueBright(authUrl));

  const code = await ask(chalk.yellowBright(
    "\nAfter the authorization, get the code from the new page's url and paste it here: "
  ));

  const { tokens: newToken } = await OAUTH2.getToken(code);

  OAUTH2.setCredentials(newToken);

  await fs.writeFile(TOKEN_PATH, JSON.stringify(newToken, null, 2));
}

async function getVideosPathsAndTitles (): Promise<Array<{ path: string, title: string }>> {
  const module = await ask(chalk.yellowBright('\nEnter the module number: '));

  const moduleInt = Math.abs(parseInt(module));

  if (isNaN(moduleInt)) {
    console.log(chalk.magentaBright('\nModule number must be an integer, try again'));
    return await getVideosPathsAndTitles();
  }

  const videos = await fs.readdir('./videos');

  return videos.map((video) => {
    const fileNameWithoutExtension = video.split('.')[0]

    return {
      path: `./videos/${video}`,
      title: fileNameWithoutExtension.startsWith('0')
        ? `${module}.${fileNameWithoutExtension.slice(1)}`
        : `${module}.${fileNameWithoutExtension}`
    }
  });
}

async function uploadVideo (youtube: youtube_v3.Youtube, videoPath: string, videoTitle: string) {
  return await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: videoTitle,
        categoryId: '22'
      },
      status: {
        privacyStatus: 'private',
        selfDeclaredMadeForKids: false
      }
    },
    media: {
      body: createReadStream(videoPath)
    }
  });
}

async function insertVideoInPlaylist (youtube: youtube_v3.Youtube, videoId: string) {
  await youtube.playlistItems.insert({
    part: ['snippet'],
    requestBody: {
      snippet: {
        playlistId: PLAYLIST_ID_TO_INSERT_VIDEOS,
        resourceId: {
          kind: 'youtube#video',
          videoId
        }
      }
    }
  });
}

async function main () {
  try {
    if (!CLIENT_SECRET || !CLIENT_ID || !PLAYLIST_ID_TO_INSERT_VIDEOS) {
      throw new Error('Missing env vars, please check .env.example');
    }

    await getAuth();

    const youtube = google.youtube({ version: 'v3', auth: OAUTH2 });

    const videosToUpload = await getVideosPathsAndTitles();

    for (const { path, title } of videosToUpload) {
      const uploadResponse = await uploadVideo(youtube, path, title);

      const videoId = uploadResponse.data.id;

      if (!videoId) {
        throw new Error('Error uploading video, video id missing on upload response');
      }

      await insertVideoInPlaylist(youtube, videoId);
    }
    console.log(chalk.greenBright('\nDone!\n'));
  } catch (error: unknown) {
    console.log(chalk.redBright(error));
  }
}

// INIT
void main();
