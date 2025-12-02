declare module 'opensubtitles-api' {
  interface OpenSubtitlesOptions {
    useragent: string
    username?: string
    password?: string
    ssl?: boolean
  }

  interface SearchOptions {
    sublanguageid?: string
    hash?: string
    filesize?: number
    path?: string
    filename?: string
    season?: string | number
    episode?: string | number
    extensions?: string[]
    limit?: string | number
    imdbid?: string
    fps?: number
    query?: string
    gzip?: boolean
  }

  interface SubtitleResult {
    url: string
    langcode: string
    downloads: string
    lang: string
    encoding: string
    id: string
    filename: string
    score: number
    fps: number
    format: string
    utf8: string
    vtt: string
  }

  interface SearchResult {
    [language: string]: SubtitleResult | SubtitleResult[]
  }

  class OpenSubtitles {
    constructor(options: OpenSubtitlesOptions)
    login(): Promise<void>
    search(options: SearchOptions): Promise<SearchResult>
  }

  export default OpenSubtitles
}

