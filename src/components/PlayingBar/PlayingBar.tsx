import { useEffect, useState, useRef } from "react";
import useFetchAudio from "../../hooks/useFetchAudio";
import SongControls from "./SongControls";
import SongInfo from "./SongInfo";
import AudioControls from "./AudioControls";
import { AudioSettingsProp } from "../../App";
import audioList from "../../audioList";
import { audioDataType } from "../../types";

interface PlayingBarProps {
  audioSettings: AudioSettingsProp | null;
  setAudioSettings: React.Dispatch<
    React.SetStateAction<AudioSettingsProp | null>
  >;
  isUserGesture: boolean;
  songInfo: any;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  queue: audioDataType[];
}

export default function PlayingBar({
  audioSettings,
  setAudioSettings,
  isUserGesture,
  songInfo,
  isPlaying,
  setIsPlaying,
  queue,
}: PlayingBarProps) {
  const [queueIndex, setQueueIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer>();

  const songOffsetRef = useRef(0);
  const songDurationRef = useRef(0);
  const currentTimeRef = useRef(0);
  const startTime = useRef(0);
  const timeIntervalRef = useRef<any>(null);

  const audioData = useFetchAudio(
    queue[queueIndex]?.audioData.path,
    isUserGesture
  );

  useEffect(() => {
    const buffer = queue[queueIndex]?.audioData.buffer;
    console.log(buffer);

    if (audioData) {
      setAudioBuffer(audioData);
      console.log("path");
    } else if (buffer) {
      setAudioBuffer(buffer);
      console.log("buffer");
    } else {
      console.log("No source");
    }
  }, [audioData, queueIndex]);

  useEffect(() => {
    initSong(0);
  }, [audioBuffer]);

  //code to play audio using bufferSourceNode
  const initSong = (songStartTime: number) => {
    if (!audioBuffer || !audioSettings) return;

    const { audioCtx, gainNode, analyser, source: oldSource } = audioSettings;

    //store song duration
    songDurationRef.current = audioBuffer.duration;

    //setup new AudioBufferSourceNode
    const source = audioCtx.createBufferSource();
    source.connect(gainNode);
    source.connect(analyser);

    //clean old AudioBufferSourceNode
    if (oldSource) {
      oldSource.stop();
      oldSource.disconnect();
    }

    //start audio
    source.buffer = audioBuffer;
    source.start(audioCtx.currentTime, songStartTime, audioBuffer.duration);

    //store start time
    startTime.current = audioCtx.currentTime;
    songOffsetRef.current = songStartTime;

    //store source reference
    setAudioSettings((prevSettings) => ({
      ...(prevSettings as AudioSettingsProp),
      source: source,
    }));
  };

  //handle song ended
  function handleAudioEnded() {
    const list = audioList;
    const currentIndex = queueIndex;

    if (currentIndex < list.length) {
      //play next song
      setQueueIndex((currentIndex) => currentIndex + 1);
    } else {
      //restart & pause current song
      setIsPlaying(false);
      initSong(0);
    }
  }

  //listen for playing + track elapsed time
  useEffect(() => {
    if (!audioSettings?.audioCtx || !audioSettings.source) return;

    //update time elapsed
    let timeInterval = timeIntervalRef.current;
    let songEnded = false;
    const startInterval = () => {
      timeInterval = setInterval(() => {
        let preciseCurrentTime =
          audioSettings.audioCtx.currentTime +
          songOffsetRef.current -
          startTime.current;

        // round to 1s
        let roundedCurrentTime = Math.floor(preciseCurrentTime);

        //Has atleast 1s elapsed
        if (
          roundedCurrentTime !== currentTimeRef.current &&
          preciseCurrentTime <= songDurationRef.current
        ) {
          currentTimeRef.current = roundedCurrentTime;
          setCurrentTime(currentTimeRef.current);
        }

        //Has song ended?
        if (preciseCurrentTime >= songDurationRef.current && !songEnded) {
          handleAudioEnded();
          songEnded = true;
        }
      }, 50);
    };

    //listen for playing
    if (isPlaying) {
      audioSettings.audioCtx.resume();
      if (!timeInterval) startInterval();
    } else {
      audioSettings.audioCtx.suspend();
      if (timeInterval) {
        clearInterval(timeInterval);
        timeInterval = null;
      }
    }

    //update timeIntervalRef
    timeIntervalRef.current = timeInterval;
  }, [isPlaying]);

  return (
    <div className="now-playing-bar flex items-center justify-center h-20 bg-neutral-950">
      <div className="flex text-white w-full">
        <SongInfo songInfo={songInfo} />
        <SongControls
          {...{
            isPlaying,
            setIsPlaying,
            setQueueIndex,
            audioSettings,
            songDuration: songDurationRef.current,
            songTime: currentTime,
            initSong,
          }}
        />
        <AudioControls volumeControls={audioSettings?.gainNode} />
      </div>
    </div>
  );
}
