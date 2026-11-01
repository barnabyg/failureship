import { useEffect, useRef, useState } from "react";
import { panelText } from "../content";
import type { Choice, Hotspot, Room } from "../engine";
import { Tower, type ScreenPoint } from "../tower/tower";

interface Props {
  rooms: readonly Room[];
  hotspots: readonly Hotspot[];
  legal: readonly Choice[];
  onChoose: (choice: Choice) => void;
}

const canTake = (legal: readonly Choice[], actionId: string) =>
  legal.some((c) => c.type === "action" && c.actionId === actionId);

/** The tower with its hotspots: a model behind, and labelled buttons in front. */
export function TowerStage({ rooms, hotspots, legal, onChoose }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const tower = useRef<Tower | null>(null);
  const roomClick = useRef<(roomId: string) => void>(() => undefined);
  const [points, setPoints] = useState<Map<string, ScreenPoint>>(new Map());

  useEffect(() => {
    roomClick.current = (roomId) => {
      const hotspot = hotspots.find((h) => h.place === roomId);
      if (hotspot) onChoose({ type: "action", actionId: hotspot.id });
    };
  }, [hotspots, onChoose]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const built = new Tower(element, rooms, (id) => {
      roomClick.current(id);
    });
    tower.current = built;
    const observer = new ResizeObserver(() => {
      built.resize();
      setPoints(built.projectRooms());
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      built.dispose();
      tower.current = null;
    };
  }, [rooms]);

  useEffect(() => {
    const clickable = hotspots.filter((h) => canTake(legal, h.id));
    const done = hotspots.filter((h) => h.state === "done");
    tower.current?.setRooms(
      new Set(clickable.map((h) => h.place)),
      new Set(done.map((h) => h.place)),
    );
  }, [hotspots, legal]);

  return (
    <div className="stage" ref={stage}>
      {rooms.map((room) => {
        const point = points.get(room.id);
        if (!point || !room.sign) return null;
        return (
          <div
            key={room.id}
            className="hotspot room-sign"
            data-testid={`room-sign-${room.id}`}
            style={{ left: point.x, top: point.y }}
          >
            <span className="hotspot-label">{room.sign.title}</span>
            <span className="hotspot-detail">{room.sign.detail}</span>
          </div>
        );
      })}
      {hotspots.map((hotspot) => {
        const point = points.get(hotspot.place);
        if (!point) return null;
        const enabled = canTake(legal, hotspot.id);
        return (
          <button
            key={hotspot.id}
            type="button"
            className={`hotspot hotspot-${hotspot.state}`}
            data-testid={`hotspot-${hotspot.id}`}
            style={{ left: point.x, top: point.y }}
            disabled={!enabled}
            title={hotspot.description}
            onClick={() => {
              onChoose({ type: "action", actionId: hotspot.id });
            }}
          >
            <span className="hotspot-label">{hotspot.label}</span>
            <span className="hotspot-detail">
              {hotspot.state === "done"
                ? panelText.doneLabel
                : hotspot.state === "unavailable"
                  ? panelText.unavailableLabel
                  : hotspot.costLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
