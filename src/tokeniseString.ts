import natural from "natural";
import stopword from "stopword";

const VALID_TOKEN_REGEX = /[a-z]{2,}/;

/**
 * Given a string generate tokens:
 * - using `TreebankWordTokenizer`.
 * - convert to lowercase
 * - remove stop words
 * - remove token without at least 2 consequent letters
 *
 * @export
 * @param {string} txt input string
 * @return {*}  {string[]}
 */
export default function tokeniseString(txt: string): string[] {
    const tokenizer = new natural.TreebankWordTokenizer();
    const tokens = tokenizer.tokenize(txt);
    if (!tokens?.length) {
        return [];
    }
    return stopword.removeStopwords(
        tokens
            .map(item => item.toLowerCase())
            .filter(item => VALID_TOKEN_REGEX.test(item))
    );
}
