export enum Prompt {
	SentenceEnglishToFrench = 'promptSentenceEnglishToFrench',
	EnglishToFrench = 'promptEnglishToFrench'
}

export const promt_description: { [key in Prompt]: string } = {
	promptSentenceEnglishToFrench:
		"Pouvez-vous traduire ce texte en francais sans ajouter d'informations ? Voici le texte :",
	promptEnglishToFrench:
		'Traduisez ces mots en français. Écrivez simplement la traduction  :',
};
