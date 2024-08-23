export interface ITranslate {
  detect(text: string): Promise<string>;
  translate(
    text: string,
    fromLanguage: string,
    toLanguage: string,
  ): Promise<string>;
}
