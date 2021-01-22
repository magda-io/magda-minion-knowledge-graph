FROM ubuntu:20.04

RUN apt-get update && \
    apt-get -y install sudo

# Setup non-root user
RUN adduser --disabled-password --gecos '' admin && \
    adduser admin sudo && \
    touch /etc/sudoers.d/extras && \
    echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers.d/extras && \
    echo 'Defaults secure_path="/usr/local/miniconda/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin"' >> /etc/sudoers.d/extras && \
    chmod 0440 /etc/sudoers.d/extras

USER admin

# install python & conda
RUN cd ~ && \
    sudo cat /etc/sudoers.d/extras && \
    sudo apt-get update && \
    sudo apt-get -y upgrade && \
    sudo apt-get install -y python3 wget curl git && \
    wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh && \
    sudo bash ./Miniconda3-latest-Linux-x86_64.sh -b -p /usr/local/miniconda && \
    sudo conda create --name kg python=3.6 -y

# install nodejs & yarn
RUN curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash - && \
    sudo apt-get install -y nodejs && \
    sudo npm install --global yarn

# copy source code
RUN sudo mkdir -p /usr/src/app
COPY . /usr/src/app
WORKDIR /usr/src/app/component

# install python code dependencies
RUN sudo conda run -n kg pip install -r /usr/src/app/component/psrc/requirements.txt && \
    sudo conda run -n kg python -m spacy download en_core_web_sm

ENV PATH="/usr/local/miniconda/bin:${PATH}"

ENTRYPOINT [ "node", "/usr/src/app/component/dist/index.js" ]
