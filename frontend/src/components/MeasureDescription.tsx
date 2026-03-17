import { useState } from "react";
import measureInfo from "../data/measure_info.json";

type MeasureKey = keyof typeof measureInfo;

interface Props {
  measure: MeasureKey;
}

export function MeasureDescription({ measure }: Props) {
  const [expanded, setExpanded] = useState(false);
  const info = measureInfo[measure];
  if (!info) return null;

  return (
    <div className="measure-description">
      <p className="measure-short">{info.short_description}</p>
      {!expanded ? (
        <button
          className="measure-toggle"
          onClick={() => setExpanded(true)}
        >
          read more...
        </button>
      ) : (
        <>
          <div className="measure-expanded">
            <p>{info.long_description}</p>
            <p className="measure-provenance">
              <strong>Methodology: </strong>
              {info.provenance}
            </p>
            {info.sources.length > 0 && (
              <p className="measure-sources">
                <strong>Sources: </strong>
                {info.sources.map((s, i) => (
                  <span key={i}>
                    {i > 0 && "; "}
                    <a href={s.location_url} target="_blank" rel="noopener noreferrer">
                      {s.location}
                    </a>
                    {" "}({s.name})
                  </span>
                ))}
              </p>
            )}
          </div>
          <button
            className="measure-toggle"
            onClick={() => setExpanded(false)}
          >
            show less
          </button>
        </>
      )}
    </div>
  );
}
