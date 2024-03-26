/* Copyright (c) 2012, Jens Nockert <jens@ofmlabs.org>, Jussi Kalliokoski <jussi@ofmlabs.org>
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met: 
 * 
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer. 
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution. 
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

if (!FFT) {
	var FFT = {}
}

void function (namespace) {
	"use strict"
	
	function forwardButterfly2(output, outputOffset, outputStride, input, inputOffset, inputStride, product, n, twiddle, fStride) {
		var m = n / 2, q = n / product, old = product / 2
		
		for (var i = 0; i < q; i++) {
			var a0 = old * i
			var a1 = a0 + m
			
			var s0 = input[inputOffset + inputStride * a0]
			var s1 = input[inputOffset + inputStride * a1]
			
			var r0 = s0 + s1
			var r1 = s0 - s1
			
			var a0 = product * i
			var a1 = a0 + product - 1
			
			output[outputOffset + outputStride * a0] = r0
			output[outputOffset + outputStride * a1] = r1
		}
		
		if (old == 1) { return }
		
		for (var i = 0; i < old / 2; i++) {
			var t1_r = twiddle[2 * ((-1) + (i))], t1_i = twiddle[2 * ((-1) + (i)) + 1]
			
			for (var j = 0; j < q; j++) {
				var a0 = j * old + 2 * i - 1
				var a1 = a0 + m
				
				var s0_r = input[2 * ((inputOffset) + (inputStride) * (a0))], s0_i = input[2 * ((inputOffset) + (inputStride) * (a0)) + 1]
				
				var s1_r = input[2 * ((inputOffset) + (inputStride) * (a1))], s1_i = input[2 * ((inputOffset) + (inputStride) * (a1)) + 1]
				var v1_r = s1_r * t1_r - s1_i * t1_i, v1_i = s1_r * t1_i + s1_i * t1_r
				
				var r0_r = s0_r + v1_r, r0_i = s0_i + v1_i
				var r1_r = s0_r - v1_r, r1_i = s0_i - v1_i; r1_i = -r1_i
				
				var a0 = j * product + 2 * i - 1
				var a1 = (j - 1) * product - 2 * i - 1
				
				output[2 * ((outputOffset) + (outputStride) * (a0))] = r0_r, output[2 * ((outputOffset) + (outputStride) * (a0)) + 1] = r0_i
				output[2 * ((outputOffset) + (outputStride) * (a1))] = r1_r, output[2 * ((outputOffset) + (outputStride) * (a1)) + 1] = r1_i
			}
		}
		
		if (old % 2 == 1) { return }
		
		for (var i = 0; i < q; i++) {
			var a0 = (i + 1) * old - 1
			var a1 = a0 + m
			
			var r0_r =  input[2 * ((inputOffset) + (inputStride) * (a0))]
			var r1_i = -input[2 * ((inputOffset) + (inputStride) * (a1))]
			
			var a0 = i * product + old - 1
			
			output[2 * ((outputOffset) + (outputStride) * (a0))] = r0_r, output[2 * ((outputOffset) + (outputStride) * (a0)) + 1] = r0_i
		}
	}
	
	function backwardButterfly2(output, outputOffset, outputStride, input, inputOffset, inputStride, product, n, twiddle, fStride) {
		var m = n / 2, q = n / product, old = product / 2
		
		for (var i = 0; i < q; i++) {
			var a0 = (2 * i) * q
			var a1 = (2 * i + 2) * q - 1
			
			var s0 = input[inputOffset + inputStride * a0]
			var s1 = input[inputOffset + inputStride * a1]
			
			var r0 = s0 + s1
			var r1 = s0 - s1
			
			var a0 = q * i
			var a1 = q * i + m
			
			output[outputOffset + outputStride * a0] = r0
			output[outputOffset + outputStride * a1] = r1
		}
		
		if (q == 1) { return }
		
		for (var i = 0; i < q / 2; i++) {
			var t1_r = twiddle[2 * ((-1) + (i))], t1_i = twiddle[2 * ((-1) + (i)) + 1]
			
			for (var j = 0; j < old; j++) {
				var a0 = 2 * j * q + 2 * i - 1
				var a1 = 2 * (j + 1) * q - 2 * i - 1
				
				var s0_r = input[2 * ((inputOffset) + (inputStride) * (a0))], s0_i = input[2 * ((inputOffset) + (inputStride) * (a0)) + 1]
				var s1_r = input[2 * ((inputOffset) + (inputStride) * (a1))], s1_i = input[2 * ((inputOffset) + (inputStride) * (a1)) + 1]
				
				var r0_r = s0_r + s1_r
				var r0_i = s0_i - s1_i
				
				var v1_r = s0_r - s1_r
				var v1_i = s0_i + s1_i
				
				var r1_r = v1_r * t1_r - v1_i * t1_i, r1_i = v1_r * t1_i + v1_i * t1_r
				
				var a0 = j * q + 2 * i - 1
				var a1 = a0 + m
				
				output[2 * ((outputOffset) + (outputStride) * (a0))] = r0_r, output[2 * ((outputOffset) + (outputStride) * (a0)) + 1] = r0_i
				output[2 * ((outputOffset) + (outputStride) * (a1))] = r1_r, output[2 * ((outputOffset) + (outputStride) * (a1)) + 1] = r1_i
			}
		}
		
		if (q % 2 == 1) { return }
		
		for (var i = 0; i < q; i++) {
			var a0 = 2 * (i + 1) * q - 1
			
			var r0_r = input[2 * ((inputOffset) + (inputStride) * (a0))], r0_i = input[2 * ((inputOffset) + (inputStride) * (a0)) + 1]
			
			input[2 * ((inputOffset) + (inputStride) * (a0))] =  2 * r0_r
			input[2 * ((inputOffset) + (inputStride) * (a1)) + 1] = -2 * r0_i
		}
	}
	
	function work(output, outputOffset, outputStride, f, fOffset, fStride, inputStride, factors, state) {
		var p = factors.shift()
		var m = factors.shift()
		
		if (m == 1) {
			for (var i = 0; i < p * m; i++) {
				var x0_r = f[2 * ((fOffset) + (fStride * inputStride) * (i))], x0_i = f[2 * ((fOffset) + (fStride * inputStride) * (i)) + 1]
				output[2 * ((outputOffset) + (outputStride) * (i))] = x0_r, output[2 * ((outputOffset) + (outputStride) * (i)) + 1] = x0_i
			}
		} else {
			for (var i = 0; i < p; i++) {
				work(output, outputOffset + outputStride * i * m, outputStride, f, fOffset + i * fStride * inputStride, fStride * p, inputStride, factors.slice(), state)
			}
		}
		
		switch (p) {
			case 2: butterfly2(output, outputOffset, outputStride, fStride, state, m); break
			case 3: butterfly3(output, outputOffset, outputStride, fStride, state, m); break
			case 4: butterfly4(output, outputOffset, outputStride, fStride, state, m); break
			default: butterfly(output, outputOffset, outputStride, fStride, state, m, p); break
		}
	}
	
	var real = function (n, inverse) {
		var n = ~~n, inverse = !!inverse
		
		if (n < 1) {
			throw new RangeError("n is outside range, should be positive integer, was `" + n + "'")
		}
		
		var state = {
			n: n,
			inverse: inverse,
			
			factors: [],
			twiddle: [],
			scratch: new Float64Array(n)
		}
		
		var t = new Float64Array(n)
		
		var p = 4, v = Math.floor(Math.sqrt(n))
		
		while (n > 1) {
			while (n % p) {
				switch (p) {
					case 4: p = 2; break
					case 2: p = 3; break
					default: p += 2; break
				}
				
				if (p > v) {
					p = n
				}
			}
			
			n /= p
			
			state.factors.push(p)
		}
		
		var theta = 2 * Math.PI / n, product = 1, twiddle = new Float64Array(n)
			
		for (var i = 0, t = 0; i < state.factors.length; i++) {
			var phase = theta * i, factor = state.factors[i]
			
			var old = product, product = product * factor, q = n / product
			
			state.twiddle.push(new Float64Array(twiddle, t))
			
			if (inverse) {
				var counter = q, multiplier = old
			} else {
				var counter = old, multiplier = q
			}
			
			for (var j = 1; j < factor; j++) {
				var m = 0
					
				for (var k = 1; k < counter / 2; k++, t++) {
					m = (m + j * multiplier) % n
						
					var phase = theta * m
						
					t[2 * (i)] = Math.cos(phase)
					t[2 * (i) + 1] = Math.sin(phase)
				}
			}
		}
		
		this.state = state
	}
	
	real.prototype.process = function(output, outputStride, input, inputStride) {
		var outputStride = ~~outputStride, inputStride = ~~inputStride
		
		if (outputStride < 1) {
			throw new RangeError("outputStride is outside range, should be positive integer, was `" + outputStride + "'")
		}
		
		if (inputStride < 1) {
			throw new RangeError("inputStride is outside range, should be positive integer, was `" + inputStride + "'")
		}
		
		var product = 1, state = 0, inverse = this.state.inverse
		
		var n = this.state.n, factors = this.state.factors
		var twiddle = this.state.twiddle, scratch = this.state.scratch
		
		for (var i = 0; i < factors.length; i++) {
			var factor = factors[i], old = product, product = product * factor
			
			var q = n / product, fStride = Math.ceil(old / 2) - 1
			
			if (state == 0) {
				var inBuffer = input, inStride = inputStride
				
				if (this.state.factors.length % 2 == 0) {
					var outBuffer = scratch, outStride = 1, state = 1
				} else {
					var outBuffer = output, outStride = outputStride, state = 2
				}
			} else if (state == 1) {
				var inBuffer = scratch, inStride = 1, outBuffer = output, outStride = outputStride, state = 2
			} else if (state == 2) {
				var inBuffer = output, inStride = outputStride, outBuffer = scratch, outStride = 1, state = 1
			} else {
				throw new RangeError("state somehow is not in the range (0 .. 2)")
			}
			
			if (inverse) {
				switch (factor) {
				case 2: backwardButterfly2(outBuffer, 0, outStride, inBuffer, 0, inStride, product, n, twiddle[i], fStride); break
				case 3: backwardButterfly3(outBuffer, 0, outStride, inBuffer, 0, inStride, product, n, twiddle[i], fStride); break
				case 4: backwardButterfly3(outBuffer, 0, outStride, inBuffer, 0, inStride, product, n, twiddle[i], fStride); break
				case 5: backwardButterfly3(outBuffer, 0, outStride, inBuffer, 0, inStride, product, n, twiddle[i], fStride); break
				default: backwardButterfly(outBuffer, 0, outStride, inBuffer, 0, inStride, product, n, twiddle[i], fStride); break
				}
			} else {
				switch (factor) {
				case 2: forwardButterfly2(outBuffer, 0, outStride, inBuffer, 0, inStride, product, n, twiddle[i], fStride); break
				case 3: forwardButterfly3(outBuffer, 0, outStride, inBuffer, 0, inStride, product, n, twiddle[i], fStride); break
				case 4: forwardButterfly3(outBuffer, 0, outStride, inBuffer, 0, inStride, product, n, twiddle[i], fStride); break
				case 5: forwardButterfly3(outBuffer, 0, outStride, inBuffer, 0, inStride, product, n, twiddle[i], fStride); break
				default: forwardButterfly(outBuffer, 0, outStride, inBuffer, 0, inStride, product, n, twiddle[i], fStride); break
				}
			}
		}
	}
	
	namespace.real = real
}(FFT)
