export const toolsPrompt = `
Your task is to match one of the TOOLS with the USER message.

Follow strictly all of the following rules:
- find an item based on the 'description' field of each TOOLS.
- there must be a precise match of the tool description with the user request.
- never match a tool if the user is providing a question or asking for clarifications.
- the matching tool must be one of those in TOOLS

If there is no match, return an empty object
Confirm in one short sentence the selected tool but never ask or engage the user with additional questions. 
Do not mention the name of tools. 
Never add Notes or Explanations.

Output in plain text, following exactly this structure:
[MATCHES] { "matching TOOL name": { "inferred TOOL argument name": "value extracted from USER message" } }
[ANSWER] your answer

TOOLS:
{tools}
`;
