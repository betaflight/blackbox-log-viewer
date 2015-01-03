"use strict";

//Convert a hexadecimal string (that represents a binary 32-bit float) into a float
function hexToFloat(string) {
	var arr = new Uint32Array(1);
	arr[0] = parseInt(string, 16);
	
	var floatArr = new Float32Array(arr.buffer);
	
	return floatArr[0];	
}

function asciiArrayToString(arr) {
	return String.fromCharCode.apply(null, arr);
}

function asciiStringToByteArray(s) {
    var bytes = [];
    
	for (var i = 0; i < s.length; i++)
		bytes.push(s.charCodeAt(i));
	
	return bytes;
}

function signExtend24Bit(u) {
    //If sign bit is set, fill the top bits with 1s to sign-extend
    return (u & 0x800000) ? (u | 0xFF000000) : u;
}

function signExtend16Bit(word) {
    //If sign bit is set, fill the top bits with 1s to sign-extend
    return (word & 0x8000) ? (word | 0xFFFF0000) : word;
}

function signExtend14Bit(word) {
    //If sign bit is set, fill the top bits with 1s to sign-extend
    return (word & 0x2000) ? (word | 0xFFFFC000) : word;
}

function signExtend8Bit(byte) {
    //If sign bit is set, fill the top bits with 1s to sign-extend
    return (byte & 0x80) ? (byte | 0xFFFFFF00) : byte;
}

function signExtend6Bit(byte) {
    //If sign bit is set, fill the top bits with 1s to sign-extend
    return (byte & 0x20) ? (byte | 0xFFFFFFC0) : byte;
}

function signExtend4Bit(nibble) {
    //If sign bit is set, fill the top bits with 1s to sign-extend
    return (nibble & 0x08) ? (nibble | 0xFFFFFFF0) : nibble;
}

function signExtend2Bit(byte) {
    //If sign bit is set, fill the top bits with 1s to sign-extend
    return (byte & 0x02) ? (byte | 0xFFFFFFFC) : byte;
}

/**
 * Get the first index of needle in haystack, or -1 if it was not found. Needle and haystack
 * are both byte arrays.
 * 
 * Provide startIndex in order to specify the first index to search from
 * @param haystack
 * @param needle
 * @returns {Number}
 */
function memmem(haystack, needle, startIndex) {
	var i, j, found;
	
	for (var i = startIndex ? startIndex : 0; i <= haystack.length - needle.length; i++) {
		if (haystack[i] == needle[0]) {
			for (var j = 1; j < needle.length && haystack[i + j] == needle[j]; j++)
				;
		
			if (j == needle.length)
				return i;
		}
	}
	
	return -1;
}

function parseCommaSeparatedIntegers(string) {
	var 
		parts = string.split(","),
		result = new Array(parts.length);
	
	for (var i = 0; i < parts.length; i++) {
		result[i] = parseInt(parts[i], 10);
	}

	return result;
}

/**
 * Find the index of `item` in `list`, or if `item` is not contained in `list` then return the index
 * of the next-smaller element (or -1 if `item` is smaller than all values in `list`).
 * @param list
 * @param item
 * @returns
 */
function binarySearchOrPrevious(list, item) {
	var
		min = 0,
		max = list.length - 1,
		guess;
	
	if (list.length == 0)
		return -1;
		
	while (min <= max) {
		//Use ceil so if we get down to two elements we examine the top one which can shrink our max
		guess = Math.ceil((min + max) / 2);
		
		if (list[guess] === item)
			return guess;
		else if (list[guess] < item)
			if (min == max) //Wouldn't make any progress if min == max, so...
				return guess;
			else
				min = guess; 
		else
			max = guess - 1;
	}
	
	return -1;
}