FROM node:8-slim
MAINTAINER Nathan Smith <nathanrandal@gmail.com>

ENV TINI_VERSION v0.16.1
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]

WORKDIR /opt/longcut
ADD package.json package.json

RUN npm install

ADD . .
