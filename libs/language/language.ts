import { Logger } from '@nestjs/common';
import { LanguageCode, SupportedLanguageCodes } from './lang-codes';
import { languagesMap, languagesMapKV } from './languagesMap';

const SupportedLanguageCodesList =
  SupportedLanguageCodes as unknown as string[];

const logger = new Logger('language');

export const mapLanguageCode = (language: string): LanguageCode | null => {
  language = languagesMapKV[language] || language;

  if (languagesMap[language]) {
    let matchingLanguage = languagesMap[language];
    switch (matchingLanguage) {
      case 'en':
        matchingLanguage = 'en-GB';
        break;
      case 'de':
        matchingLanguage = 'de-DE';
        break;
      case 'it':
        matchingLanguage = 'it-IT';
        break;
      default:
        const matches = SupportedLanguageCodes.filter(
          (v) => v.indexOf(matchingLanguage) > -1,
        );
        if (matches.length === 0) return null;
        matchingLanguage = matches[0];
    }

    return matchingLanguage as LanguageCode;
  }

  if (SupportedLanguageCodesList.includes(language)) {
    return language as LanguageCode;
  }

  logger.error(`cannot map language ${language}`);
  return null;
};
