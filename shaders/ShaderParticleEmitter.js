function ShaderParticleEmitter( options ) {
    // If no options are provided, fallback to an empty object.
    options = options || {};

    // Helps with minification. Not as easy to read the following code,
    // but should still be readable enough!
    var that = this;


    that.particlesPerSecond     = typeof options.particlesPerSecond === 'number' ? options.particlesPerSecond : 100;
    that.type                   = (options.type === 'cube' || options.type === 'sphere') ? options.type : 'cube';

    that.position               = options.position instanceof THREE.Vector3 ? options.position : new THREE.Vector3();
    that.positionSpread         = options.positionSpread instanceof THREE.Vector3 ? options.positionSpread : new THREE.Vector3();

    // These two properties are only used when this.type === 'sphere'
    that.radius                 = typeof options.radius === 'number' ? options.radius : 10;
    that.radiusScale            = options.radiusScale instanceof THREE.Vector3 ? options.radiusScale : new THREE.Vector3(1, 1, 1);

    that.acceleration           = options.acceleration instanceof THREE.Vector3 ? options.acceleration : new THREE.Vector3();
    that.accelerationSpread     = options.accelerationSpread instanceof THREE.Vector3 ? options.accelerationSpread : new THREE.Vector3();

    that.velocity               = options.velocity instanceof THREE.Vector3 ? options.velocity : new THREE.Vector3();
    that.velocitySpread         = options.velocitySpread instanceof THREE.Vector3 ? options.velocitySpread : new THREE.Vector3();

    // And again here; only used when this.type === 'sphere'
    that.speed                  = parseFloat( typeof options.speed === 'number' ? options.speed : 0, 10 );
    that.speedSpread            = parseFloat( typeof options.speedSpread === 'number' ? options.speedSpread : 0, 10 );

    that.size                   = parseFloat( typeof options.size === 'number' ? options.size : 10.0, 10 );
    that.sizeSpread             = parseFloat( typeof options.sizeSpread === 'number' ? options.sizeSpread : 0, 10 );
    that.sizeEnd                = parseFloat( typeof options.sizeEnd === 'number' ? options.sizeEnd : 10.0, 10 );

    that.colorStart             = options.colorStart instanceof THREE.Color ? options.colorStart : new THREE.Color( 'white' );
    that.colorEnd               = options.colorEnd instanceof THREE.Color ? options.colorEnd : new THREE.Color( 'blue' );
    that.colorSpread            = options.colorSpread instanceof THREE.Vector3 ? options.colorSpread : new THREE.Vector3();

    that.opacityStart           = parseFloat( typeof options.opacityStart !== 'undefined' ? options.opacityStart : 1, 10 );
    that.opacityEnd             = parseFloat( typeof options.opacityEnd === 'number' ? options.opacityEnd : 0, 10 );
    that.opacityMiddle          = parseFloat( 
        typeof options.opacityMiddle !== 'undefined' ? 
        options.opacityMiddle : 
        Math.abs(that.opacityEnd + that.opacityStart) / 2, 
    10 );

    that.emitterDuration        = typeof options.emitterDuration === 'number' ? options.emitterDuration : null;
    that.alive                  = parseInt( typeof options.alive === 'number' ? options.alive : 1, 10);

    that.static                 = typeof options.static === 'number' ? options.static : 0;

    // The following properties are used internally, and mostly set when this emitter
    // is added to a particle group.
    that.numParticles           = 0;
    that.attributes             = null;
    that.vertices               = null;
    that.verticesIndex          = 0;
    that.age                    = 0.0;
    that.maxAge                 = 0.0;

    that.particleIndex = 0.0;

    that.userData = {};
}


ShaderParticleEmitter.prototype = {

    /**
     * Reset a particle's position. Accounts for emitter type and spreads.
     *
     * @private
     * 
     * @param  {THREE.Vector3} p
     */
    _resetParticle: function( p ) {
        var that = this;
            spread = that.positionSpread,
            type = that.type;

        // Optimise for no position spread or radius
        if(
            ( type === 'cube' && spread.x === 0 && spread.y === 0 && spread.z === 0 ) ||
            ( type === 'sphere' && that.radius === 0 )
        ) {
            p.copy( that.position );
        }

        // If there is a position spread, then get a new position based on this spread.
        else if( type === 'cube' ) {
            that._randomizeExistingVector3( p, that.position, spread );
        }

        else if( type === 'sphere') {
            that._randomizeExistingVector3OnSphere( p, that.position, that.radius );
        }
    },


    /**
     * Given an existing particle vector, randomise it based on base and spread vectors
     *
     * @private
     * 
     * @param  {THREE.Vector3} v
     * @param  {THREE.Vector3} base
     * @param  {THREE.Vector3} spread
     */
    _randomizeExistingVector3: function( v, base, spread ) {
        var r = Math.random;

        v.copy( base );

        v.x += r() * spread.x - (spread.x/2);
        v.y += r() * spread.y - (spread.y/2);
        v.z += r() * spread.z - (spread.z/2);
    },


    /**
     * Given an existing particle vector, project it onto a random point on a 
     * sphere with radius `radius` and position `base`.
     *
     * @private
     * 
     * @param  {THREE.Vector3} v
     * @param  {THREE.Vector3} base
     * @param  {Number} radius
     */
    _randomizeExistingVector3OnSphere: function( v, base, radius ) {
        var rand = Math.random;

        var z = 2 * rand() - 1;
        var t = 6.2832 * rand();
        var r = Math.sqrt( 1 - z*z );

        var x = ((r * Math.cos(t)) * radius);
        var y = ((r * Math.sin(t)) * radius);
        var z = (z * radius); 

        v.set(x, y, z).multiply( this.radiusScale );
        
        v.add( base );
    },


    // This function is called by the instance of `ShaderParticleEmitter` that 
    // this emitter has been added to.
    /**
     * Update this emitter's particle's positions. Called by the ShaderParticleGroup
     * that this emitter belongs to.
     * 
     * @param  {Number} dt
     */
    tick: function( dt ) {

        if( this.static ) {
            return;
        }

        // Cache some values for quicker access in loops.
        var that = this,
            a = that.attributes,
            alive = a.alive.value,
            age = a.age.value,
            start = that.verticesIndex,
            numParticles = that.numParticles,
            end = start + numParticles,
            pps = that.particlesPerSecond,
            ppsdt = pps * dt,
            m = that.maxAge,
            emitterAge = that.age,
            duration = that.emitterDuration,
            pIndex = that.particleIndex;

        // Loop through all the particles in this emitter and
        // determine whether they're still alive and need advancing
        // or if they should be dead and therefore marked as such
        // and pushed into the recycled vertices array for reuse.
        for( var i = start; i < end; ++i ) {
            if( alive[ i ] === 1.0 ) {
                age[ i ] += dt;
            }

            if( age[ i ] >= m ) {
                age[ i ] = 0.0;
                alive[ i ] = 0.0;
            }
        }

        // If the emitter is dead, reset any particles that are in
        // the recycled vertices array and reset the age of the 
        // emitter to zero ready to go again if required, then
        // exit this function.
        if( that.alive === 0 ) {
            that.age = 0.0;
            return;
        }

        // If the emitter has a specified lifetime and we've exceeded it,
        // mark the emitter as dead and exit this function.
        if( typeof duration === 'number' && emitterAge > duration ) {
            that.alive = 0;
            that.age = 0.0;
            return;
        }

        var n = Math.min( end, pIndex + ppsdt );

        for( i = pIndex | 0; i < n; ++i ) {
            if( alive[ i ] !== 1.0 ) {
                alive[ i ] = 1.0;
                that._resetParticle( that.vertices[ i ] );
            }
        }

        that.particleIndex += ppsdt;

        if( pIndex >= start + that.numParticles ) {
            that.particleIndex = parseFloat( start, 10 );
        }

        // Add the delta time value to the age of the emitter.
        that.age += dt;
    },

    /**
     * Reset this emitter back to its starting position.
     * If `force` is truthy, then reset all particles in this
     * emitter as well, even if they're currently alive.
     * 
     * @param  {Boolean} force
     * @return {this}
     */
    reset: function( force ) {
        var that = this;

        that.age = 0.0;
        that.alive = 0;

        if( force ) {
            var start = that.verticesIndex,
                end = that.verticesIndex + that.numParticles,
                a = that.attributes,
                alive = a.alive.value,
                age = a.age.value;

            for( var i = start; i < end; ++i ) {
                alive[ i ] = 0.0;
                age[ i ] = 0.0;
            }
        }

        return that;
    },


    /**
     * Enable this emitter.
     */
    enable: function() {
        this.alive = 1;
    },

    /**
     * Disable this emitter.
     */
    disable: function() {
        this.alive = 0;
    }
};
