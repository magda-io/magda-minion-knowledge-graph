const delay = (milSecs: number) =>
    new Promise((resolve, reject) => {
        setTimeout(resolve, milSecs);
    });

export default delay;
