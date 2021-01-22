FROM ubuntu:20.04

RUN apt-get update && \
    apt-get -y install sudo

RUN adduser --disabled-password --gecos '' admin
RUN adduser admin sudo
RUN echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

USER admin

RUN cd ~ && \
    sudo apt-get update && \
    sudo apt-get -y upgrade && \
    sudo apt-get install -y python3 wget curl git && \
    wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh && \
    sudo bash ./Miniconda3-latest-Linux-x86_64.sh -b -p /usr/local/miniconda && \
    sudo /usr/local/miniconda/bin/conda create --name kg python=3.6 -y

RUN curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash - && \
    sudo apt-get install -y nodejs && \
    sudo npm install --global yarn

RUN sudo mkdir -p /usr/src/app
COPY . /usr/src/app
WORKDIR /usr/src/app/component

RUN sudo /usr/local/miniconda/bin/conda run -n kg pip install -r /usr/src/app/component/psrc/requirements.txt && \
    sudo /usr/local/miniconda/bin/conda run -n kg python -m spacy download en_core_web_sm

ENV PATH="/usr/local/miniconda/bin:${PATH}"

ENTRYPOINT [ "node", "/usr/src/app/component/dist/index.js" ]
