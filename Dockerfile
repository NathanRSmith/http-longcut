FROM node:6-slim
MAINTAINER Nathan Smith <nathanrandal@gmail.com>

WORKDIR /opt/longcut
ADD package.json package.json

RUN npm install

ADD . .