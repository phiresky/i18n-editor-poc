import { render } from "react-dom";
import * as React from "react";
import { observable } from "mobx";
import { observer } from "mobx-react";
import { getNextId, getMapLikeKeys } from "mobx/lib/internal";

const keyCache = new WeakMap<AstEle, number>();
let uniqueId = 1;
function getKey(e: AstEle) {
  let res = keyCache.get(e);
  if(!res) {
    res = uniqueId++;
    keyCache.set(e, res);
  }
  return res;
}

type AstEle = (
  | { type: "list"; content: AstEle[] }
  | { type: "text"; text: string }
  | { type: "object"; tag: string; content: AstEle }
) & { focus?: true };

function normalizeList(ineles: AstEle[]) {
  const outeles = ineles
    .flatMap((e) => (e.type === "list" ? e.content : e))
    .map(normalize)
    .reduce<AstEle[]>((olds, cur) => {
      const prev = olds.length > 0 ? olds[olds.length - 1] : undefined;
      return prev?.type === "text" && cur.type === "text"
        ? [...olds.slice(0, -1), { type: "text", text: prev.text + cur.text, focus: prev.focus || cur.focus }]
        : [...olds, cur];
    }, [])
    .map(normalize);
  // insert empty text nodes
  for (let i = 1; i < outeles.length; i++) {
    if (outeles[i - 1].type !== "text" && outeles[i].type !== "text") {
      outeles.splice(i, 0, { type: "text", text: "" });
    }
  }
  return outeles;
}
function normalize(ele: AstEle): AstEle {
  switch (ele.type) {
    case "list":
      return {
        type: "list",
        content: normalizeList(ele.content),
      };
    default:
      return ele;
  }
}
@observer
class AstEleUI extends React.Component<{
  ele: AstEle;
  replace: (e: AstEle) => void;
  backspace: () => void;
}> {
  render(): JSX.Element {
    const { ele, replace, backspace } = this.props;
    switch (ele.type) {
      case "text":
        return (
          <input
            value={ele.text}
            style={{ width: ele.text.length * 1.2 + "ch" }}
            ref={e => ele.focus && (delete ele.focus, e?.focus())}
            onKeyDown={(e) => {
              const isAtStart =
                e.currentTarget.selectionStart ===
                  e.currentTarget.selectionEnd &&
                e.currentTarget.selectionStart === 0;
              if (e.key === "Backspace" && isAtStart) {
                e.preventDefault();
                e.stopPropagation();
                backspace();
              }
            }}
            onChange={(e) => {
              const newText = e.currentTarget.value;
              let match;
              if ((match = /^(.*)\{([a-z0-9]+) (.*)$/i.exec(newText))) {
                replace(
                  normalize({
                    type: "list",
                    content: [
                      { type: "text", text: match[1] },
                      {
                        type: "object",
                        tag: match[2],
                        content: { type: "text", text: "", focus: true },
                      },
                      { type: "text", text: match[3] },
                    ],
                  })
                );
                return;
              }
              ele.text = newText;
            }}
          />
        );
      case "list":
        return (
          <div className="list">
            {ele.content.map((e, i) => (
              <AstEleUI
                key={getKey(e)}
                ele={e}
                replace={(e) => {
                  ele.content.splice(i, 1, e);
                  replace({
                    type: "list",
                    content: normalizeList(ele.content),
                  });
                }}
                backspace={() => {
                  if (i === 0) {
                    backspace();
                  } else {
                    console.log("backspace within list center not implemented")
                    /*const [removed] = ele.content.splice(i, 1);
                    ele.content[i - 1] = mergeAsText(
                      ele.content[i - 1],
                      removed
                    );*/
                  }
                }}
              />
            ))}
          </div>
        );
      case "object":
        return (
          <div className="object">
            <div className="tag">
              {"{"}
              {ele.tag}{" "}
            </div>
            <AstEleUI
              ele={ele.content}
              replace={(e) => (ele.content = e)}
              backspace={() =>
                replace(
                  normalize({
                    type: "list",
                    content: [
                      { type: "text", text: `{${ele.tag}`, focus: true },
                      ele.content,
                    ],
                  })
                )
              }
            />
            <div className="tag-end">{"}"}</div>
          </div>
        );
    }
  }
}

/*
{Span <
    Only bet after color
>}
{Div <
    {Select <
        {Option1 <Has not come up>}
        {Option2 <Has come up>}
    >}
>}
{Span < for >}
{Input} {Span <games in a row>}
*/

@observer
class UI extends React.Component {
  @observable ast: AstEle = {
    type: "list",
    content: [
      {
        type: "object",
        tag: "Span",
        content: { type: "text", text: "Only bet after color" },
      },
      { type: "text", text: "" },

      {
        type: "object",
        tag: "Div",
        content: {
          type: "object",
          tag: "Select",
          content: {
            type: "list",
            content: [
              {
                type: "object",
                tag: "Option1",
                content: { type: "text", text: "Has not come up" },
              },
              { type: "text", text: "" },
              {
                type: "object",
                tag: "Option2",
                content: { type: "text", text: "Has not come up" },
              },
              { type: "text", text: "" },
            ],
          },
        },
      },
      { type: "text", text: "" },
      {
        type: "object",
        tag: "Span",
        content: { type: "text", text: " for " },
      },
      { type: "text", text: "" },
      { type: "object", tag: "Input", content: { type: "text", text: "" } },
      { type: "text", text: "" },
      {
        type: "object",
        tag: "Span",
        content: { type: "text", text: "games in a row" },
      },
    ],
  };
  render() {
    Object.assign(window, { ast: this.ast });
    return (
      <div>
        <AstEleUI
          ele={this.ast}
          replace={(e) => (this.ast = e)}
          backspace={() => {}}
        />
      </div>
    );
  }
}

render(<UI />, document.getElementById("root"));
