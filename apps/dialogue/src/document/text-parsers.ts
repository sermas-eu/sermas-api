export const parseByBlock = (buffer: string, splitter = '\n') => {
  return buffer
    .split(splitter)
    .map((chunk) => chunk.trim())
    .filter((chunck) => chunck.length > 0);
};

/**
 * One chunk per paragraph (blank-line separated): a paragraph is the unit that answers
 * a question on its own. A long paragraph is cut into groups of whole sentences, a very
 * short one (a heading) joins the next. Retrieval returns a few chunks: single
 * sentences left the model with fragments, and it filled the gaps with inventions.
 */
export const parseByParagraph = (
  buffer: string,
  maxChars = 800,
  minChars = 60,
) => {
  const chunks: string[] = [];
  let carry = '';
  for (const block of parseByBlock(buffer.replace(/\r/g, ''), '\n\n')) {
    const paragraph = (carry ? `${carry}\n${block}` : block).trim();
    carry = '';
    if (paragraph.length < minChars) {
      carry = paragraph;
      continue;
    }
    if (paragraph.length <= maxChars) {
      chunks.push(paragraph);
      continue;
    }
    let group = '';
    for (const sentence of parseBySentence(paragraph)) {
      if (group && group.length + sentence.length + 1 > maxChars) {
        chunks.push(group);
        group = '';
      }
      group = group ? `${group} ${sentence}` : sentence;
    }
    if (group) chunks.push(group);
  }
  if (carry) {
    if (chunks.length) chunks[chunks.length - 1] += `\n${carry}`;
    else chunks.push(carry);
  }
  return chunks;
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
