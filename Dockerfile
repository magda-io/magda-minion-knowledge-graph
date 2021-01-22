FROM ubuntu:20.04

RUN apt-get update && \
    apt-get -y install sudo

RUN useradd -m docker && echo "docker:docker" | chpasswd && adduser docker sudo

USER docker

RUN mkdir -p /usr/src/app
COPY . /usr/src/app
WORKDIR /usr/src/app/component

RUN cd ~ && \
    sudo apt update && \
    sudo apt -y upgrade && \
    sudo apt install -y python3 wget curl git && \
    wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh && \
    sudo bash ~/Miniconda3-latest-Linux-x86_64.sh -b -p ~/miniconda && \
    export PATH="~/miniconda/bin:$PATH" && \
    cd /usr/src/app/component && \
    sudo conda create --name kg python=3.6 -y && \
    sudo conda run -n kg pip install -r python_requirements.txt && \
    sudo conda run -n kg python -m spacy download en_core_web_sm && \
    curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash - && \
    sudo apt-get install -y nodejs && \
    sudo npm install --global yarn

SHELL ["conda", "run", "-n", "kg", "/bin/bash", "-c"]

ENTRYPOINT [ "node", "/usr/src/app/component/dist/index.js" ]
