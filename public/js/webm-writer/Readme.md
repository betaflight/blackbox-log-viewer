# WebM Writer for Electron

This is a WebM video encoder based on the ideas from [Whammy][]. It allows you to turn a series of 
Canvas frames into a WebM video.

This implementation allows you to create very large video files (exceeding the size of available memory), because it
can stream chunks immediately to a file on disk while the video is being constructed, 
instead of needing to buffer the entire video in memory before saving can begin. Video sizes in excess of 4GB can be 
written. The implementation currently tops out at 32GB, but this could be extended.

When not streaming to disk, it can instead buffer the video in memory as a series of Blobs which are eventually 
returned to the calling code as one composite Blob. This Blob can be displayed in a &lt;video&gt; element, transmitted 
to a server, or used for some other purpose. Note that Chrome has a [Blob size limit][] of 500MB.

Because this library relies on Chrome's WebP encoder to do the hard work for it, it can only run in a Chrome environment 
(e.g. Chrome, Chromium, Electron), it can't run on vanilla Node.

[Whammy]: https://github.com/antimatter15/whammy
[Blob size limit]: https://github.com/eligrey/FileSaver.js/

## Usage

Add webm-writer to your project:

```
npm install --save webm-writer
```

Require and construct the writer, passing in any options you want to customize:

```js
var 
    WebMWriter = require('webm-writer'),
    
    videoWriter = new WebMWriter({
        quality: 0.95,    // WebM image quality from 0.0 (worst) to 0.99999 (best), 1.00 (VP8L lossless) is not supported
        fileWriter: null, // FileWriter in order to stream to a file instead of buffering to memory (optional)
        fd: null,         // Node.js file handle to write to instead of buffering to memory (optional)
    
        // You must supply one of:
        frameDuration: null, // Duration of frames in milliseconds
        frameRate: null,     // Number of frames per second
    
        transparent: false,      // True if an alpha channel should be included in the video
        alphaQuality: undefined, // Allows you to set the quality level of the alpha channel separately.
                                 // If not specified this defaults to the same value as `quality`.
    });
```

Add as many Canvas frames as you like to build your video:

```js
videoWriter.addFrame(canvas);
```

When you're done, you must call `complete()` to finish writing the video:

```js
videoWriter.complete();
```

`complete()` returns a Promise which resolves when writing is completed.

If you didn't supply a `fd` in the options, the Promise will resolve to Blob which represents the video. You
could display this blob in an HTML5 &lt;video&gt; tag:

```js
videoWriter.complete().then(function(webMBlob) {
    $("video").attr("src", URL.createObjectURL(webMBlob));
});
```

There's an example which saves the video to an open file descriptor instead of to a Blob on this page:

https://github.com/thenickdude/webm-writer-js/tree/master/test/electron

## Transparent WebM support

Transparent WebM files are supported, check out the example in https://github.com/thenickdude/webm-writer-js/tree/master/test/transparent. However, because I'm re-using Chrome's 
WebP encoder to create the alpha channel, and the alpha channel is taken from the Y channel of a YUV-encoded WebP frame, 
and Y values are clamped by Chrome to be in the range 22-240 instead of the full 0-255 range, the encoded video can 
neither be fully opaque or fully transparent :(.

Sorry, I wasn't able to find a workaround to get that to work.  
