const cleanString = (input: string) => {
    input = input ? input : "";
    let output = "";
    for (let i = 0; i < input.length; i++) {
        if (input.charCodeAt(i) <= 127) {
            output += input.charAt(i);
        }
    }
    return output;
};

export default cleanString;
