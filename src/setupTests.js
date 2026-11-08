// jest-dom adds custom jest matchers for asserting on DOM nodes.
import '@testing-library/jest-dom';

jest.mock('jointjs', () => ({
  dia: {
    Graph: class {
      clear() {}
      getLinks() { return []; }
    },
    Paper: class {
      on() {}
    }
  },
  shapes: {
    standard: {
      Circle: class {
        position() {}
        resize() {}
        attr() {}
        addTo() {}
      },
      Link: class {
        source() {}
        target() {}
        router() {}
        connector() {}
        attr() {}
        labels() { return []; }
        addTo() {}
      }
    }
  }
}));
