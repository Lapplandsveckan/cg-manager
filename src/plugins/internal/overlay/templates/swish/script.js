window.update = (params) => {
    try {
        console.log(params);
        params = JSON.parse(params);
    } catch (e) {
        return;
    }

    if (params.number)
        document.querySelector('.swish__number').innerText = params.number;
};

window.play = () => {
    if (state === 0 || state === 3) {
        animateIn();
        state = 1;
    }
};

window.next = () => {
    if (state === 0 || state === 1 || state === 3) {
        minimize();
        state = 2;
    }
};

window.stop = () => {
    if (state === 1 || state === 2) {
        animateOut();
        state = 3;
    }
};


const tl = new gsap.timeline({
    defaults: {
        duration: 2,
        ease: 'power2.inOut',
    },
});

tl.addLabel('start');
tl.addLabel('mid');
tl.addLabel('end');

function animateIn() {
    // Clear the timeline
    tl.clear();

    tl.set('.swish__main', {
        top: '110%',
    }, 'start');

    tl.set('.swish__sliding__top', {
        translateX: '0',
    }, 'start');

    tl.set('.swish__sliding__bottom', {
        translateX: '0',
    }, 'start');

    tl.set('.swish__number', {
        top: '50%',
        fontSize: '120pt',
    }, 'start');

    tl.set('.swish__top', {
        top: '-120%',
    }, 'start');

    // Move entire container
    tl.to('.swish__main', {
        top: '0%',
        duration: 1,
    }, 'start');
};

function minimize() {
    // Clear the timeline
    tl.clear();

    let delay = 0.3;
    if (state === 0 || state === 3) {
        delay = 0;
        tl.set('.swish__main', {
            top: '-110%',
        }, 'start');

        tl.set('.swish__sliding__top', {
            translateX: '250%',
        }, 'start');

        tl.set('.swish__sliding__bottom', {
            translateX: '-250%',
        }, 'start');

        tl.set('.swish__number', {
            top: '50%',
            fontSize: '120pt',
        }, 'start');

        tl.set('.swish__top', {
            top: '-120%',
        }, 'start');
    } else {
        tl.to('.swish__sliding__top', {
            translateX: '250%',
            duration: 1,
        }, 'mid');

        tl.to('.swish__sliding__bottom', {
            translateX: '-250%',
            duration: 1,
        }, 'mid');
    }

    tl.to('.swish__main', {
        top: '-100%',
        duration: 1,
        delay,
    }, 'mid');

    tl.to('.swish__number', {
        top: '105%',
        fontSize: '80px',

        duration: 1,
        delay,
    }, 'mid');

    tl.to('.swish__top', {
        top: '100%',

        duration: 1,
        delay,
    }, 'mid');
};

function animateOut() {
    // Clear the timeline
    tl.clear();

    tl.to('.swish__main', {
        top: '-110%',
        duration: 0.3,
    }, 'end');
};

// Example data
if (dev) window.update(JSON.stringify({
    number: '123 412 65 95',
}));