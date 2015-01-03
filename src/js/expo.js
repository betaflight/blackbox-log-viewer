"use strict";

function ExpoCurve(offset, power, inputRange, outputRange, steps) {
	var
		curve,
		inputRange, outputRange, inputScale,
		i;

	this.lookup = function(input) {
		var
			normalisedInput, valueInCurve,
			prevStepIndex;

		input += offset;

		normalisedInput = input * inputScale;

		//Straight line
		if (steps == 0)
			return normalisedInput;

		valueInCurve = Math.abs(normalisedInput);
		prevStepIndex = Math.floor(valueInCurve);

		/* If the input value lies beyond the stated input range, use the final
		 * two points of the curve to extrapolate out (the "curve" out there is a straight line, though)
		 */
		if (prevStepIndex > steps - 2) {
			prevStepIndex = steps - 2;
		}

		//Straight-line interpolation between the two curve points
		var 
			proportion = valueInCurve - prevStepIndex,
			result = curve[prevStepIndex] + (curve[prevStepIndex + 1] - curve[prevStepIndex]) * proportion;

		if (input < 0)
			return -result;
		return result;		
	};
	
	if (steps <= 2 || power == 1.0) {
		//Curve is actually a straight line
		steps = 0;
		power = 1.0;
	}
	
	curve = new Array(steps);
	
	if (steps == 0) {
		//Straight line
		inputScale = outputRange / inputRange;
	} else {
		var stepSize = 1.0 / (steps - 1);

		inputScale = (steps - 1) / inputRange;

		for (i = 0; i < steps; i++) {
			curve[i] = Math.pow(i * stepSize, power) * outputRange;
		}
	}	
}