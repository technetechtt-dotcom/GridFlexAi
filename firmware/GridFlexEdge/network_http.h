#ifndef GRIDFLEX_NETWORK_HTTP_H
#define GRIDFLEX_NETWORK_HTTP_H

#include <Arduino.h>
#include <ArduinoHttpClient.h>
#include <Client.h>
#include <Update.h>

/**
 * Small HTTP adapter that accepts any Arduino Client implementation.
 * ESP32 HTTPClient only accepts WiFiClient, which excludes TinyGSM+SSLClient.
 */
class NetworkHttpRequest {
 public:
  bool begin(Client& client, const String& url) {
    static const String HTTPS_PREFIX = "https://";
    if (!url.startsWith(HTTPS_PREFIX)) return false;

    String remainder = url.substring(HTTPS_PREFIX.length());
    int slash = remainder.indexOf('/');
    String authority = slash >= 0 ? remainder.substring(0, slash) : remainder;
    path_ = slash >= 0 ? remainder.substring(slash) : "/";

    int colon = authority.lastIndexOf(':');
    if (colon > 0) {
      host_ = authority.substring(0, colon);
      port_ = static_cast<uint16_t>(authority.substring(colon + 1).toInt());
      if (port_ == 0) return false;
    } else {
      host_ = authority;
      port_ = 443;
    }

    if (host_.isEmpty()) return false;
    client_ = &client;
    headerCount_ = 0;
    responseBody_ = "";
    return true;
  }

  void addHeader(const String& name, const String& value) {
    if (headerCount_ >= MAX_HEADERS) return;
    headers_[headerCount_++] = {name, value};
  }

  int GET() { return send("GET", ""); }
  int POST(const String& body) { return send("POST", body); }
  String getString() const { return responseBody_; }

  bool downloadToUpdate(size_t& written) {
    written = 0;
    if (!client_) return false;

    HttpClient http(*client_, host_.c_str(), port_);
    http.get(path_);
    const int status = http.responseStatusCode();
    if (status != 200) {
      http.stop();
      return false;
    }

    const long length = http.contentLength();
    if (length <= 0 || !Update.begin(static_cast<size_t>(length))) {
      http.stop();
      return false;
    }

    written = Update.writeStream(http);
    http.stop();
    return written == static_cast<size_t>(length) && Update.end();
  }

  void end() {
    client_ = nullptr;
    headerCount_ = 0;
    responseBody_ = "";
  }

 private:
  struct Header {
    String name;
    String value;
  };

  static const size_t MAX_HEADERS = 12;
  Client* client_ = nullptr;
  String host_;
  String path_ = "/";
  uint16_t port_ = 443;
  Header headers_[MAX_HEADERS];
  size_t headerCount_ = 0;
  String responseBody_;

  int send(const char* method, const String& body) {
    if (!client_) return -1;

    HttpClient http(*client_, host_.c_str(), port_);
    http.beginRequest();
    if (strcmp(method, "POST") == 0) {
      http.post(path_);
    } else {
      http.get(path_);
    }
    for (size_t i = 0; i < headerCount_; ++i) {
      http.sendHeader(headers_[i].name, headers_[i].value);
    }
    if (strcmp(method, "POST") == 0) {
      http.sendHeader("Content-Length", body.length());
      http.beginBody();
      http.print(body);
    }
    http.endRequest();

    const int status = http.responseStatusCode();
    responseBody_ = http.responseBody();
    http.stop();
    return status;
  }
};

#endif
