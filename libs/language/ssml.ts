import * as SSML from 'ssml';
import { LanguageCode } from './lang-codes';
import { Emotion } from 'libs/sermas/sermas.dto';

export const emotionToSSML = (
  text: string,
  emotion: Emotion,
  language: LanguageCode,
): string => {
  let ssmlDoc = new SSML({ language });

  switch (emotion) {
    case 'sad':
      ssmlDoc = ssmlDoc
        .prosody({
          pitch: '-10%',
          rate: 'slow',
        })
        .say(text);
      break;

    case 'disgust':
      ssmlDoc = ssmlDoc
        .prosody({
          volume: 'loud',
        })
        .say(text);
      break;

    case 'angry':
      ssmlDoc = ssmlDoc
        .prosody({
          volume: 'x-loud',
          rate: 'fast',
        })
        .say(text);
      break;

    case 'happy':
      ssmlDoc = ssmlDoc
        .prosody({
          rate: 'fast',
          pitch: '+10%',
        })
        .say(text);
      break;

    case 'surprise':
      ssmlDoc = ssmlDoc
        .prosody({
          contour: '(0%,+10%)(10%,+20%)(50%,-10%)(100%,+10%)',
        })
        .say(text);
      break;

    case 'fear':
      ssmlDoc = ssmlDoc
        .prosody({
          pitch: '-10%',
        })
        .say(text);
      break;
    case 'neutral':
    default:
      ssmlDoc = ssmlDoc.say(text);
      break;
  }

  // logger.debug(
  //   `Converting ${text} to \n\n ${ssmlDoc.toString({ pretty: true })}`,
  // );

  return ssmlDoc.toString();
};
