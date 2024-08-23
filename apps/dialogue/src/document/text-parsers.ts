export const parseByBlock = (buffer: string, splitter = '\n') => {
  return buffer
    .split(splitter)
    .map((chunk) => chunk.trim())
    .filter((chunck) => chunck.length > 0);
};

export const parseBySentence = (buffer: string) => {
  const chunks: string[] = [];
  // buffer = (buffer || '').replace(/\n/gim, ' ');
  const regex = /[^\d|.| ][.?!\n][^\d|\w]/i;
  let match = buffer.match(regex);
  let tail = '';
  while (match && match?.index !== undefined) {
    let phrase = buffer.substring(0, match?.index + 2);
    phrase = (tail + phrase).trim().replace(/\n|\r/gm, '');
    tail = '';
    if (phrase.length) {
      if (phrase.length > 20) {
        chunks.push(phrase);
      } else {
        tail += `${phrase} `;
      }
    }
    buffer = buffer.substring(match?.index + 2);
    match = buffer.match(regex);
  }

  buffer = (tail + buffer).trim().replace(/\n|\r/gm, '');
  if (buffer.length) {
    chunks.push(buffer);
  }

  // console.log(chunks);
  return chunks;
};
