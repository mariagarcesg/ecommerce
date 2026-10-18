FROM golang:1.26-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /auth .

FROM alpine:3.22

COPY --from=build /auth /usr/local/bin/auth

EXPOSE 8081

CMD ["auth"]
