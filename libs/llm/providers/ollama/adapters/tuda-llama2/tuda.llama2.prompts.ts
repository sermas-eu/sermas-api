export const llama2Prompt = `Given is the following task-oriented dialog between a human user (<user>) and a virtual agent (<assistant>). 
Previously, this conversation went wrong because the virtual agent made a statement that was contextually incorrect.
The human user reacted accordingly (No, I don't think so. I asked for assistance with my legal dispute.). 
Generate the user's intent (<intent>), extract the slot values (<slots>) and generate the next system utterance by considering the user's emotion ({emotion}). 

<dialog> 
{history}`;
