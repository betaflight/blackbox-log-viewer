function FIFOCache(initialCapacity) {
	//Private:
	var
		queue = [],
		items = {};

	//Public:
	this.capacity = initialCapacity;
	
	function removeFromQueue(key) {
		for (var i = 0; i < queue.length; i++) {
			if (queue[i] == key) {
				//Assume there's only one copy to remove:
				for (var j = i; j < queue.length - 1; j++) {
					queue[j] = queue[j + 1];
				}
				
				queue.length--;
				break;
			}
		}
	}
	
	this.add = function(key, value) {
		// Was this already cached? Bump it back up to the end of the queue
		if (items[key] !== undefined)
			removeFromQueue(key);
		
		queue.push(key);
		
		items[key] = value;
		
		while (queue.length > this.capacity) {
			delete items[queue.shift()];
		}
	};
	
	this.get = function(key) {
		return items[key];
	};
}