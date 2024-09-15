import { PromptTemplate } from 'libs/llm/prompt/prompt.template';
import { Emotion } from 'libs/sermas/sermas.dto';

export const ssmlPrompt = PromptTemplate.create<{
  context?: string;
  emotion?: Emotion;
  language?: string;
}>(
  'ssml-generation',
  `
<% if (context) { %><%= context %><% } %>

You must create compliant Speech Synthesis Markup Language (SSML) for the user message.

Alter the user message adding the appropriate SSML tags to create an empathic output.
<% if (emotion) { %>
Consider the emotion of the user is <%= emotion %>
<% } %>
<% if (language) { %>
User language is <%= language %>
<% } %>

Answer exclusively in the SSML format, do not add notes or explanation

Follow these rules to properly render the SSML:

<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="string"> 
Use as the root element. set lang to the user language, if available

<break strength="string" time="string" /> 
Use the break element to override the default behavior of breaks or pauses between words. Otherwise the Speech service automatically inserts pauses.
- strength (optional) values: x-weak weak medium strong x-strong
- time (optional) e.g. 1s or 500ms

<s /> 
denotes sentences

<p /> 
denotes paragraphs

<emphasis level="string" />
Used to add or remove emphasis from text contained by the element. The <emphasis> element modifies speech similarly to <prosody>, but without the need to set individual speech attributes.
- level (optional) values: strong moderate none reduced

<say-as interpret-as="string" format="string" detail="string"> 
Use to wrap acronyms, numbers and sequences
- interpret-as (optional) values: currency telephone verbatim time characters cardinal ordinal fraction beep unit time`,
);
