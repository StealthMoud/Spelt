// Original examples and memory cues. Bundled so a first practice needs no API key or connection.
export const COLLECTIONS = [
  {
    id: 'double-letters', title: 'Double trouble', symbol: 'cc',
    description: 'Get comfortable with those easy-to-miss double letters.',
    words: [
      ['accommodate', 'verb', 'to provide enough room for someone or something', 'The table can accommodate six guests.', 'Two c’s and two m’s: accommodate has room for both pairs.'],
      ['necessary', 'adjective', 'needed for a particular purpose', 'A ticket is necessary to enter the museum.', 'One c, two s’s. Picture one collar and two sleeves.'],
      ['recommend', 'verb', 'to suggest that something is a good choice', 'Can you recommend a book for the journey?', 'One c, two m’s: re + commend.'],
      ['embarrass', 'verb', 'to make someone feel awkward or ashamed', 'I did not mean to embarrass you in front of everyone.', 'Two r’s, two s’s. Remember both pairs in embarrass.'],
      ['occasion', 'noun', 'a particular event or time', 'We baked a cake for the special occasion.', 'Double c, single s. An occasion has two c’s to celebrate.']
    ]
  },
  {
    id: 'quiet-letters', title: 'Quiet letters', symbol: 'kn',
    description: 'Notice the letters your ears can’t always catch.',
    words: [
      ['knowledge', 'noun', 'information and understanding gained through learning', 'Her knowledge of local plants helped us on the walk.', 'Start with know, then add ledge. The k stays quiet.'],
      ['doubt', 'noun', 'a feeling of uncertainty', 'There was no doubt that the keys were missing.', 'The b is silent, but it belongs between u and t.'],
      ['subtle', 'adjective', 'delicate or difficult to notice', 'There was a subtle change in her voice.', 'Keep the quiet b: sub + tle.'],
      ['receipt', 'noun', 'a written record of a purchase or payment', 'Keep the receipt in case you need to return the shoes.', 'Receive becomes receipt: keep cei and add the silent p before t.'],
      ['honest', 'adjective', 'truthful and not trying to deceive', 'Please give me an honest answer.', 'The h is silent. Write honest, even though you hear onest.']
    ]
  },
  {
    id: 'everyday-tricky', title: 'Everyday, remembered', symbol: 'a→e',
    description: 'Make a few familiar spelling traps feel familiar in the right way.',
    words: [
      ['separate', 'adjective', 'not joined or connected', 'Put the clean towels in a separate basket.', 'There is a rat in separate: se + parat + e. Keep the a in the middle.'],
      ['definitely', 'adverb', 'without any doubt', 'I will definitely be there on Saturday.', 'Build it from definite + ly. There is no a.'],
      ['privilege', 'noun', 'a special right or advantage', 'It was a privilege to hear her story.', 'One l, no d. Think privi + lege.'],
      ['rhythm', 'noun', 'a regular pattern of beats or movement', 'She tapped the rhythm with her foot.', 'Six letters: r-h-y-t-h-m. The y does the vowel’s work.'],
      ['receive', 'verb', 'to get or be given something', 'You will receive a message when the order is ready.', 'For this word, c is followed by ei: re + ceive.']
    ]
  }
];

export function spellingTip(word) {
  const key = word?.trim().toLowerCase();
  return COLLECTIONS.flatMap(collection => collection.words).find(entry => entry[0] === key)?.[4] || '';
}
