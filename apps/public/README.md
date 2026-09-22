# Public App

The public site serves HTML by default. Request Markdown from any document page with HTTP content negotiation:

```sh
curl -H 'Accept: text/markdown' https://nulldiary.io/about
curl -H 'Accept: text/markdown' https://nulldiary.io/m/<short-id>
```

The response uses `Content-Type: text/markdown; charset=utf-8` and is not stored by intermediaries. Requests that do not accept `text/html` or `text/markdown` receive `406 Not Acceptable`.
