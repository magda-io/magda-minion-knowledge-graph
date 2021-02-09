FROM ubuntu:20.04

SHELL [ "/bin/bash", "--login", "-c" ]

RUN apt-get update && \
    apt-get -y install sudo python3 wget curl git && \
    apt-get clean

# Setup non-root user
RUN adduser --disabled-password --gecos '' admin && \
    adduser admin sudo && \
    touch /etc/sudoers.d/extras && \
    echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers.d/extras && \
    echo 'Defaults secure_path="/usr/local/miniconda/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin"' >> /etc/sudoers.d/extras && \
    chmod 0440 /etc/sudoers.d/extras

USER admin

# install nodejs & yarn
RUN curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash - && \
    sudo apt-get install -y nodejs && \
    sudo apt-get clean && \
    sudo npm install --global yarn

# install miniconda
ENV HOME=/home/admin
ENV MINICONDA_VERSION=4.9.2
ENV CONDA_DIR="${HOME}/miniconda"
RUN wget --quiet https://repo.anaconda.com/miniconda/Miniconda3-py38_$MINICONDA_VERSION-Linux-x86_64.sh -O ~/miniconda.sh && \
    chmod +x ~/miniconda.sh && \
    ~/miniconda.sh -b -p $CONDA_DIR && \
    rm ~/miniconda.sh

# make non-activate conda commands available
ENV PATH=$CONDA_DIR/bin:$PATH

# make conda activate command available from /bin/bash --login shells
RUN echo ". $CONDA_DIR/etc/profile.d/conda.sh" >> ~/.profile
# make conda activate command available from /bin/bash --interative shells
RUN conda init bash

# create a project directory inside user home
ARG PROJECT_DIR="${HOME}/app"
RUN mkdir -p ${PROJECT_DIR}
COPY --chown=admin:admin . $PROJECT_DIR
WORKDIR $PROJECT_DIR/component
ARG PWD="${PROJECT_DIR}/component"

# build the conda environment
ENV ENV_PREFIX=$PROJECT_DIR/env
RUN conda update --name base --channel defaults conda && \
    conda create --prefix $ENV_PREFIX python=3.6 -y && \
    conda clean --all --yes
# run the postBuild script to install any JupyterLab extensions
RUN cd ${PWD}/psrc && \
    conda activate $ENV_PREFIX && \
    pip install -r requirements.txt && \
    rm -rf ~/.cache/pip

ENTRYPOINT conda activate $ENV_PREFIX && node ${PWD}/dist/index.js
