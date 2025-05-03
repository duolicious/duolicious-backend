import {
  useEffect,
  useRef,
} from 'react';
import { isMobile } from '../../util/util';
import { notify } from '../../events/events';
import { ScrollViewData } from '../navigation/scroll-bar';

const findDomNode = (x: any, maxRecursionDepth = 99) => {
  if (isMobile()) {
    return null;
  }

  if (maxRecursionDepth < 0) {
    console.warn('recursion limit reached while looking for dom node');
    return null;
  }

  if (x instanceof Node) {
    return x;
  }

  if ('_reactInternals' in x) {
    return findDomNode(x._reactInternals, maxRecursionDepth - 1);
  }

  if ('child' in x && x?.elementType === 'div') {
    return x?.stateNode;
  }

  if ('child' in x) {
    return findDomNode(x.child, maxRecursionDepth - 1);
  }

  return null;
};

const useScrollbar = (controller: string) => {
  const observer = useRef<IntersectionObserver | null>(null);

  const lastScrollViewHeight = useRef(0);
  const lastContentHeight = useRef(0);
  const lastOffset = useRef(0);

  useEffect(() => {
    if (isMobile()) {
      return;
    }

    return () => {
      if (observer.current) {
        observer.current.disconnect();
        observer.current = null;
      }
    }
  }, []);

  return useRef({
    onLayout: (params) => {
      if (isMobile()) {
        return;
      }

      lastScrollViewHeight.current = params.nativeEvent.layout.height;

      notify<ScrollViewData>(
        'main-scroll-view',
        {
          controller,
          scrollViewHeight: lastScrollViewHeight.current,
          contentHeight: lastContentHeight.current,
          offset: lastOffset.current,
        }
      );
    },
    onContentSizeChange: (contentWidth, contentHeight) => {
      if (isMobile()) {
        return;
      }

      lastContentHeight.current = contentHeight;

      notify<ScrollViewData>(
        'main-scroll-view',
        {
          controller,
          scrollViewHeight: lastScrollViewHeight.current,
          contentHeight: lastContentHeight.current,
          offset: lastOffset.current,
        }
      );
    },
    onScroll: ({nativeEvent}) => {
      if (isMobile()) {
        return;
      }

      lastOffset.current = nativeEvent.contentOffset.y;

      notify<ScrollViewData>(
        'main-scroll-view',
        {
          controller,
          offset: lastOffset.current,
        }
      )
    },
    showsVerticalScrollIndicator: isMobile(),
    observeListRef: (node): void => {
      if (isMobile()) {
        return;
      }
      if (!node) {
        return;
      }

      if (observer.current) {
        observer.current.disconnect();
      }

      const onThumbDrag = (offset: number) => {
        if (typeof node.scrollToOffset === 'function') {
          node.scrollToOffset({ offset, animated: false });
        } else if (typeof node.scrollTo === 'function') {
          node.scrollTo({ y: offset, animated: false });
        } else {
          throw new Error('No scroll method found on ref');
        }
      };

      observer.current = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) {
            notify<ScrollViewData>(
              'main-scroll-view',
              {
                controller,
                onThumbDrag: null,
              }
            );

            return;
          }

          notify<ScrollViewData>(
            'main-scroll-view',
            {
              controller,
              scrollViewHeight: lastScrollViewHeight.current,
              contentHeight: lastContentHeight.current,
              offset: lastOffset.current,
              onThumbDrag: onThumbDrag,
            }
          );
        },
        { root: null }
      );

      const maybeDiv = findDomNode(node);

      if (maybeDiv) {
        observer.current.observe(maybeDiv);
      }
    }
  }).current;
};

const useScrollbarStyle = () => {
  const desktopScrollbarCSS = `
  ::-webkit-scrollbar {
    width: 14px;
  }

  ::-webkit-scrollbar-track {
    background: #ddd;
  }

  ::-webkit-scrollbar-thumb {
    background-color: #70f;
    border-radius: 99px;
  }

  @-moz-document url-prefix() {
    * {
      scrollbar-color: #70f #ddd;
    }

    *::-moz-scrollbar-thumb {
      border-radius: 99px;
    }
  }
  `;

  useEffect(() => {
    if (!isMobile()) {
      const styleEl = document.createElement('style');
      styleEl.textContent = desktopScrollbarCSS;
      document.head.appendChild(styleEl);
    }
  }, []);
};

export {
  useScrollbar,
  useScrollbarStyle,
};
