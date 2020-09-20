import {
	MathUtils,
	Spherical,
	Vector3
} from "three";

// Code below was adapted from ThreeJs example "FirstPersonControls"
var FpsStyleControls = function (object, domElement) {
	if (domElement === undefined) {

		console.warn('FpsStyleControls: The second parameter "domElement" is mandatory.');
		domElement = document;
	}

	this.object = object;
	this.domElement = domElement;

	// API
	this.enabled = true;

	this.movementSpeed = 1.0;
	this.lookSpeed = 0.005;

	this.lookVertical = true;
	this.autoForward = false;

	this.activeLook = true;

	this.heightSpeed = false;
	this.heightCoef = 1.0;
	this.heightMin = 0.0;
	this.heightMax = 1.0;

	this.constrainVertical = false;
	this.verticalMin = 0;
	this.verticalMax = Math.PI;

	this.mouseDragOn = false;

	// internals
	this.autoSpeedFactor = 0.0;

	this.mouseX = 0;
    this.mouseY = 0;
    
    this.xVelocity = 0;
    this.yVelocity = 0;
    this.zVelocity = 0;

	this.moveForward = false;
	this.moveBackward = false;
	this.moveLeft = false;
    this.moveRight = false;
    
    this.turnLeft = false;
    this.turnRight = false;

	this.viewHalfX = 0;
	this.viewHalfY = 0;

	// private variables
	var lat = 0;
	var lon = 0;

	var lookDirection = new Vector3();
	var spherical = new Spherical();
	var target = new Vector3();

	if (this.domElement !== document) {
		this.domElement.setAttribute('tabindex', - 1);
	}

	this.handleResize = function () {
		if (this.domElement === document) {
			this.viewHalfX = window.innerWidth / 2;
			this.viewHalfY = window.innerHeight / 2;
		} else {
			this.viewHalfX = this.domElement.offsetWidth / 2;
			this.viewHalfY = this.domElement.offsetHeight / 2;
		}
	};

	this.onMouseDown = function (event) {
		if (this.domElement !== document) {
			this.domElement.focus();
		}

		event.preventDefault();
		event.stopPropagation();

		this.mouseDragOn = true;
	};

	this.onMouseUp = function (event) {
		event.preventDefault();
		event.stopPropagation();

		this.mouseDragOn = false;
	};

	this.onMouseMove = function (event) {
		if (this.domElement === document) {
			this.mouseX = event.pageX - this.viewHalfX;
			this.mouseY = event.pageY - this.viewHalfY;
		} else {
			this.mouseX = event.pageX - this.domElement.offsetLeft - this.viewHalfX;
			this.mouseY = event.pageY - this.domElement.offsetTop - this.viewHalfY;
		}
	};

	this.onKeyDown = function (event) {
        var handled = false;

        // Make sure that if the user presses ctrl-r, we don't prevent refresh
        if (event.ctrlKey) return;

		switch (event.keyCode) {
			case 38: /*up*/
			case 87: /*W*/ this.moveForward = true; handled = true; break;

            case 37: /*left*/ this.turnLeft = true; handled = true; break;
            
			case 65: /*A*/ this.moveLeft = true; handled = true; break;

			case 40: /*down*/
			case 83: /*S*/ this.moveBackward = true; handled = true; break;

            case 39: /*right*/ this.turnRight = true; handled = true; break;
            
			case 68: /*D*/ this.moveRight = true; handled = true; break;

			case 82: /*R*/ this.moveUp = true; handled = true; break;
			case 70: /*F*/ this.moveDown = true; handled = true; break;
        }
        
        if (handled) {
		    event.preventDefault();
        }
	};

	this.onKeyUp = function (event) {
		switch (event.keyCode) {
			case 38: /*up*/
			case 87: /*W*/ this.moveForward = false; break;

			case 37: /*left*/ this.turnLeft = false; break;
			case 65: /*A*/ this.moveLeft = false; break;

			case 40: /*down*/
			case 83: /*S*/ this.moveBackward = false; break;

			case 39: /*right*/ this.turnRight = false; break;
			case 68: /*D*/ this.moveRight = false; break;

			case 82: /*R*/ this.moveUp = false; break;
			case 70: /*F*/ this.moveDown = false; break;
		}
	};

	this.lookAt = function (x, y, z) {
		if (x.isVector3) {
			target.copy(x);
		} else {
			target.set(x, y, z);
		}

		this.object.lookAt(target);

		setOrientation(this);

		return this;
	};

	this.update = function () {
		var targetPosition = new Vector3();

		return function update(delta) {

			if (this.enabled === false) return;

			if (this.moveForward) this.zVelocity = -300;
			if (this.moveBackward) this.zVelocity = 300;

			if (this.moveLeft) this.xVelocity = -150;
			if (this.moveRight) this.xVelocity = 150;

			if (this.moveDown) this.yVelocity = -200;
			if (this.moveUp) this.yVelocity = 200;

            this.object.translateX(this.xVelocity * delta);
            this.object.translateY(this.yVelocity * delta);
            this.object.translateZ(this.zVelocity * delta);

            this.xVelocity *= 0.85;
            this.yVelocity *= 0.85;
            this.zVelocity *= 0.85;

            if (this.turnLeft) lon += delta * 150;
            if (this.turnRight) lon -= delta * 150;

            // Code below calculates polar coordinates for the look direction based on lat and lon,
            // then calculates a targetPosition in world space that the camera should look at
            // accordingly, then tells the camera to look at that location.
            
            lat = 0; // Always look out at the horizon - not angled up or down

			var phi = MathUtils.degToRad(90 - lat);
			var theta = MathUtils.degToRad(lon);

			var position = this.object.position;

			targetPosition.setFromSphericalCoords(1, phi, theta).add(position);

			this.object.lookAt(targetPosition);
		};
	}();

	function contextmenu(event) {
		event.preventDefault();
	}

	this.dispose = function () {
		this.domElement.removeEventListener('contextmenu', contextmenu, false);
		this.domElement.removeEventListener('mousedown', _onMouseDown, false);
		this.domElement.removeEventListener('mousemove', _onMouseMove, false);
		this.domElement.removeEventListener('mouseup', _onMouseUp, false);

		window.removeEventListener('keydown', _onKeyDown, false);
		window.removeEventListener('keyup', _onKeyUp, false);
	};

	var _onMouseMove = bind(this, this.onMouseMove);
	var _onMouseDown = bind(this, this.onMouseDown);
	var _onMouseUp = bind(this, this.onMouseUp);
	var _onKeyDown = bind(this, this.onKeyDown);
	var _onKeyUp = bind(this, this.onKeyUp);

	this.domElement.addEventListener('contextmenu', contextmenu, false);
	this.domElement.addEventListener('mousemove', _onMouseMove, false);
	this.domElement.addEventListener('mousedown', _onMouseDown, false);
	this.domElement.addEventListener('mouseup', _onMouseUp, false);

	window.addEventListener('keydown', _onKeyDown, false);
	window.addEventListener('keyup', _onKeyUp, false);

	function bind(scope, fn) {
		return function () {
			fn.apply(scope, arguments);
		};
	}

	function setOrientation(controls) {
		var quaternion = controls.object.quaternion;

		lookDirection.set(0, 0, - 1).applyQuaternion(quaternion);
		spherical.setFromVector3(lookDirection);

		lat = 90 - MathUtils.radToDeg(spherical.phi);
		lon = MathUtils.radToDeg(spherical.theta);
	}

	this.handleResize();

	setOrientation(this);
};

export { FpsStyleControls };