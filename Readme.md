# Cleanflight Blackbox Explorer

![Main explorer interface](screenshots/main-interface.jpg)

This tool allows you to open logs recorded by Cleanflight's Blackbox feature in your web browser. You can seek through
the log to examine graphed values at each timestep. If you have a flight video, you can load that in as well and it'll
be played behind the log.

## Using the explorer

First, download the contents of this repository by clicking the "download ZIP" button on the right of this page. Unpack
the zip somewhere on your computer, and double click "index.html" file to open it with your web browser. Click the
"Open log file/video" button at the top right and select your logged ".TXT" file and your flight video (if you recorded 
one).

You can scroll through the log by clicking or dragging on the seek bar that appears underneath the main graph. The 
current time is represented by the vertical red bar in the center of the graph.

## Syncing your log to your flight video

The blackbox plays a short beep on the buzzer when arming, and this corresponds with the start of the logged data.
You can sync your log against your flight video by pressing the "start log here" button when you hear the beep in the
video. You can tune the alignment of the log manually by editing the value in the "log sync" box. Positive values
move the log toward the end of the video, negative values move it towards the beginning.

## Notes

This tool has not been tested on Internet Explorer, but definitely won't work on versions earlier than version 9.

Your web browser must support the video codec that your flight video uses in order to play it. Firefox doesn't support
H.264 videos on Mac, so if your video won't play, try Google Chrome instead.

The best performing web browser tends to be Google Chrome, especially when trying to play your flight video at the same
time.

This tool is currently in the Alpha stage, so a number of features have yet to be implemented:

- You can only view the first log within a given log file 
- There is no option for choosing which values you want to graph
- There is no control over the amount of smoothing applied to the graph lines
- There are no buttons to help you nudge the log alignment with the video
- There is no way to single-step between loop iterations with the arrow keys

## License

This project is licensed under GPLv3.