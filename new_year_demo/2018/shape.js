class Particle {
  constructor( mass, x, y, z, s, t ) {
    this.mass = mass;
    this.position = [ x, y, z ];
    this.texcoord = [ s, t ];
    this.old_position = [ x, y, z ];
    //this.acceleration = [ 0, 0, 0 ];
  }
  update( t, ext, g ) {
    if( this.mass > 0.0 ) {
      let temp = this.position.slice();
      this.position[ 0 ] -= ext[ 0 ] * 0.0005;
      this.position[ 1 ] += ext[ 1 ] * 0.0005;
      this.position = numeric.add( this.position, numeric.add( numeric.sub( this.position, this.old_position ), numeric.mul( t*t, g ) ) );
      this.old_position = temp;
    }
  }
  add_position( pos, is_force ) {
    if( ( this.mass > 0.0 ) || ( is_force ) ) {
      this.position = numeric.add( this.position, pos )
    }
  }
}

function cross( p0, p1 ) {
  return [
    p0[ 1 ] * p1[ 2 ] - p0[ 2 ] * p1[ 1 ],
    p0[ 2 ] * p1[ 0 ] - p0[ 0 ] * p1[ 2 ],
    p0[ 0 ] * p1[ 1 ] - p0[ 1 ] * p1[ 0 ]
  ]
}

function volume( a, b, c, d ) {
  let ab = numeric.sub( b, a );
  let ac = numeric.sub( c, a );
  let ad = numeric.sub( d, a );
  return numeric.dotVV( ad, cross( ab, ac ) );
}

function normalize( a ) {
  let length = numeric.norm2( a );
  return numeric.div( a, length );
}

function perspective( fieldOfViewInRadians, aspectRatio, near, far ) {
  let f = 1.0 / Math.tan(fieldOfViewInRadians / 2);
  let rangeInv = 1 / (near - far);
  return [
    [ f / aspectRatio, 0, 0, 0 ],
    [ 0, f, 0, 0 ],
    [ 0, 0, (near + far) * rangeInv, near * far * rangeInv * 2 ],
    [ 0, 0, -1, 0 ]
  ];
}

function look_at( eye, target, up ) {
  let vz = normalize( numeric.sub( eye, target ) );
  let vx = normalize( cross( vz, up ) );
  let vy = cross( vz, vx );
  return numeric.inv( [
    [ vx[ 0 ], vx[ 1 ], vx[ 2 ], eye[ 0 ] ],
    [ vy[ 0 ], vy[ 1 ], vy[ 2 ], eye[ 1 ] ],
    [ vz[ 0 ], vz[ 1 ], vz[ 2 ], eye[ 2 ] ],
    [ 0.0, 0.0, 0.0, 1.0 ]
  ] )
}

function to_gl_mat( mat ) {
  return [
    mat[ 0 ][ 0 ], mat[ 1 ][ 0 ], mat[ 2 ][ 0 ], mat[ 3 ][ 0 ],
    mat[ 0 ][ 1 ], mat[ 1 ][ 1 ], mat[ 2 ][ 1 ], mat[ 3 ][ 1 ],
    mat[ 0 ][ 2 ], mat[ 1 ][ 2 ], mat[ 2 ][ 2 ], mat[ 3 ][ 2 ],
    mat[ 0 ][ 3 ], mat[ 1 ][ 3 ], mat[ 2 ][ 3 ], mat[ 3 ][ 3 ]
  ];
}

class Constraint {
  constructor( a, b ) {
    this.p = [ a, b ];
    this.rest_length = numeric.norm2( numeric.sub( b.position, a.position ) );
    this.stiffness = 0.1;
    this.lambda = 0.0;
  }
  solve( dt ) {
    let mass = this.p.map( ( p ) => { return p.mass } );
    let sum_mass = mass.reduce( ( x, y ) => { return x + y } );
    if ( sum_mass == 0 ) { return; }
    let a = this.p[ 0 ];
    let b = this.p[ 1 ];
    let ab = numeric.sub( b.position, a.position );
    let length = numeric.norm2( ab );
    let constraint = length - this.rest_length;
    let compliance = 0.00000001;
    //let compliance = 0.000001;
    compliance /= dt * dt;
    let dlambda = ( -constraint - compliance * this.lambda ) / ( sum_mass + compliance );
    let correction_vector = numeric.mul( ab, dlambda / ( length + 1.19209e-07 ) );
    this.lambda += dlambda;
    //let correction_vector = numeric.mul( numeric.div( ab, length ), this.stiffness * -constraint/ sum_mass );
    a.add_position( numeric.mul( numeric.neg( correction_vector ), mass[ 0 ] ) );
    b.add_position( numeric.mul( correction_vector, mass[ 1 ] ) );
  }
}

class Cloth {
  constructor( w_, h_ ) {
    this.width = w_;
    this.height = h_;
    this.particles = [];
    this.constraints = [];
    let yb = Math.cos( Math.PI * 0.4 );
    let zb = Math.sin( Math.PI * 0.4 );
    for( let h = 0; h != this.height; h++ ) {
      for( let w = 0; w != this.width; w++ ) {
        let mass = 0.5 / ( w_ * h_ );
        if( h == this.height - 1 ) {
          if( w < 2 || w > this.width - 3 ) {
            mass = 0.0;
          }
        }
        this.particles.push( new Particle( mass,  w / ( this.width  -1 ), h / ( this.height - 1 ) * yb + ( 1 - yb ), ( 1 - h / ( this.height - 1 ) ) * zb,  w / ( this.width  -1 ), h / ( this.height - 1 ) ) );
      }
    }
    for( let n = 1; n != 3; n++ ) {
      for( let h = 0; h != this.height; h++ ) {
        for( let w = 0; w != this.width; w++ ) {
          if( w < this.width - n ) {
            this.constraints.push( new Constraint( this.particles[ w + h * this.width ], this.particles[ w + n + h * this.width ] ) );
          }
          if( h < this.height - n ) {
            this.constraints.push( new Constraint( this.particles[ w + h * this.width ], this.particles[ w + ( h + n ) * this.width ] ) );
          }
          if( w < this.width - n && h < this.height - n ) {
            this.constraints.push( new Constraint( this.particles[ w + h * this.width ], this.particles[ w + n + ( h + n ) * this.width ] ) );
            this.constraints.push( new Constraint( this.particles[ w + n + h * this.width ], this.particles[ w + ( h + n ) * this.width ] ) );
          }
        }
      }
    }
  }
  update( dt, iteration, ext, g ) {
    this.particles.map( ( p ) => { p.update( dt, ext, g ) } );
    this.constraints.map( ( c ) => { c.lambda = 0.0 } );
    for( let i = 0; i < iteration; i++ ) {
      this.constraints.map( ( c ) => { c.solve( dt ) } );
    }
  }
}

class Renderer {
  constructor( name ) {
    this.counter = 0;
    this.reference = $(name);
    this.canvas = this.reference.get( 0 );
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
    this.left = window.screenLeft;
    this.top = window.screenTop;
    this.g = [ 0, -9.8, 0 ];
    let width = this.canvas.width;
    let height = this.canvas.height;
    try {
      if( this.is_ios )
        this.gl = this.canvas.getContext("webgl" ) || this.canvas.getContext( "experimental-webgl" );
      else
        this.gl = this.canvas.getContext("webgl", { preserveDrawingBuffer: true } ) || this.canvas.getContext( "experimental-webgl", { preserveDrawingBuffer: true } );
      if( !this.gl ) {
        bootstrap_alert.warning('このWebページを正しく動作させるにはWebGLに対応したブラウザが必要です');
        throw Error( 'このWebページを正しく動作させるにはWebGLに対応したブラウザが必要です' );
      }
    }
    catch(e) {
      bootstrap_alert.warning('このWebページを正しく動作させるにはWebGLに対応したブラウザが必要です');
      throw Error( 'このWebページを正しく動作させるにはWebGLに対応したブラウザが必要です' );
    }
    let gl = this.gl;
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable( gl.DEPTH_TEST );
    gl.depthFunc( gl.LEQUAL );
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
    this.p0vs = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource( this.p0vs, $("#p0vs").get( 0 ).text );
    gl.compileShader( this.p0vs );
    if( !gl.getShaderParameter ( this.p0vs, gl.COMPILE_STATUS ) ){
      throw new Error( gl.getShaderInfoLog( this.p0vs ) );
    }
    this.p0fs = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource( this.p0fs, $("#p0fs").get( 0 ).text );
    gl.compileShader( this.p0fs );
    if( !gl.getShaderParameter ( this.p0fs, gl.COMPILE_STATUS ) ){
      throw new Error( gl.getShaderInfoLog( this.p0fs ) );
    }
    this.p0program = gl.createProgram();
    gl.attachShader( this.p0program, this.p0vs );
    gl.attachShader( this.p0program, this.p0fs );
    gl.linkProgram( this.p0program );
    if( !gl.getProgramParameter( this.p0program, gl.LINK_STATUS ) ) {
      throw new Error( gl.getShaderInfoLog( this.p0program ) );
    }
    gl.useProgram( this.p0program );
    let pos_index = gl.getAttribLocation( this.p0program, 'pos' );
    let nor_index = gl.getAttribLocation( this.p0program, 'nor' );
    let tex_index = gl.getAttribLocation( this.p0program, 'tex' );
    gl.enableVertexAttribArray( pos_index );
    gl.enableVertexAttribArray( nor_index );
    gl.enableVertexAttribArray( tex_index );
    gl.viewport( 0, 0, this.canvas.width, this.canvas.height );
    let modelview_index = gl.getUniformLocation( this.p0program, 'modelview' );
    let projection_index = gl.getUniformLocation( this.p0program, 'projection' );
    let eye_index = gl.getUniformLocation( this.p0program, 'eye' );
    let light_index = gl.getUniformLocation( this.p0program, 'light' );
    let sampler_index = gl.getUniformLocation( this.p0program, 'sampler0' );
    let pers = perspective( 30, (this.canvas.width/this.canvas.height), 0.1, 20 );
    let eye_pos = [ 0.5, 0.3, 1 ];
    let light_pos = [ 1.5, 1.5, 3.0 ];
    let look = look_at(
      eye_pos,
      [ 0.5, 0.3, 0 ],
      [ 0, 1, 0 ]
    );
    let projection = to_gl_mat( numeric.dot( pers, look ) );
    let modelview = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];// to_gl_mat( look );
    gl.uniformMatrix4fv( projection_index, false, projection );
    gl.uniformMatrix4fv( modelview_index, false, modelview );
    gl.uniform3fv( eye_index, eye_pos );
    gl.uniform3fv( light_index, light_pos );
    gl.uniform1i( sampler_index, 0 );
    gl.enable( gl.CULL_FACE );
    gl.cullFace( gl.FRONT );
    this.cloth = new Cloth( 20, 20 );
    let that = this;
    this.image = new Image();
    this.texture = gl.createTexture();
    this.image.onload = () => {
      let gl = that.gl;
      gl.bindTexture( gl.TEXTURE_2D, that.texture );
      gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, that.image );
      gl.generateMipmap( gl.TEXTURE_2D );
      gl.activeTexture( gl.TEXTURE0 );
      console.log( 'テクスチャ読み込み完了' );
    };
    this.image.src = './tex.png';
  }
  resize() {
    let gl = this.gl;
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
    let width = this.canvas.width;
    let height = this.canvas.height;
    gl.viewport( 0, 0, this.canvas.width, this.canvas.height );
    let projection_index = gl.getUniformLocation( this.p0program, 'projection' );
    let pers = perspective( 30, (this.canvas.width/this.canvas.height), 0.1, 20 );
    let eye_pos = [ 0.5, 0.3, 1 ];
    let light_pos = [ 1.5, 1.5, 3.0 ];
    let look = look_at(
      eye_pos,
      [ 0.5, 0.3, 0 ],
      [ 0, 1, 0 ]
    );
    let projection = to_gl_mat( numeric.dot( pers, look ) );
    gl.uniformMatrix4fv( projection_index, false, projection );
  }
  generate_mesh() {
    let gl = this.gl;
    this.vector_length = 8;
    let mesh = new Float32Array( ( this.cloth.width - 1 ) * ( this.cloth.height - 1 ) * 6 * this.vector_length );
    let t = [ 2, 3, 0, 0, 3, 1 ];
    let cur = 0;
    let normals = new Float32Array( ( this.cloth.width ) * ( this.cloth.height ) * 3 );
    for( let h = 1; h != this.cloth.height - 1; h++ ) {
      for( let w = 1; w != this.cloth.width - 1; w++ ) {
        let i = [
          w + h * this.cloth.width,
          w - 1 + h * this.cloth.width,
          w + 1 + h * this.cloth.width,
          w + ( h - 1 ) * this.cloth.width,
          w + ( h + 1 ) * this.cloth.width
        ];
        let p = i.map( ( index ) => this.cloth.particles[ index ].position );
        let n1 = cross( numeric.sub( p[ 2 ], p[ 0 ] ), numeric.sub( p[ 4 ], p[ 0 ] ) );
        let n2 = cross( numeric.sub( p[ 0 ], p[ 1 ] ), numeric.sub( p[ 0 ], p[ 3 ] ) );
        let nx = numeric.add( n1, n2 );
        let n = normalize( numeric.div( nx, numeric.norm2( nx ) ) );
        let nindex = ( w + h * this.cloth.width ) * 3;
        normals[ nindex + 0 ] = n[ 0 ];
        normals[ nindex + 1 ] = n[ 1 ];
        normals[ nindex + 2 ] = n[ 2 ];
        cur += 3;
      }
      {
        let dindex = ( 0 + h * this.cloth.width ) * 3;
        let sindex = ( 1 + h * this.cloth.width ) * 3;
        normals[ dindex + 0 ] = normals[ sindex + 0 ];
        normals[ dindex + 1 ] = normals[ sindex + 1 ];
        normals[ dindex + 2 ] = normals[ sindex + 2 ];
      }
      {
        let dindex = ( this.cloth.width - 1 + h * this.cloth.width ) * 3;
        let sindex = ( this.cloth.width - 2 + h * this.cloth.width ) * 3;
        normals[ dindex + 0 ] = normals[ sindex + 0 ];
        normals[ dindex + 1 ] = normals[ sindex + 1 ];
        normals[ dindex + 2 ] = normals[ sindex + 2 ];
      }
    }
    for( let w = 0; w != this.cloth.width; w++ ) {
      {
        let dindex = ( w + 0 * this.cloth.width ) * 3;
        let sindex = ( w + 1 * this.cloth.width ) * 3;
        normals[ dindex + 0 ] = normals[ sindex + 0 ];
        normals[ dindex + 1 ] = normals[ sindex + 1 ];
        normals[ dindex + 2 ] = normals[ sindex + 2 ];
      }
      {
        let dindex = ( w + ( this.cloth.height - 1 ) * this.cloth.width ) * 3;
        let sindex = ( w + ( this.cloth.height - 2 ) * this.cloth.width ) * 3;
        normals[ dindex + 0 ] = normals[ sindex + 0 ];
        normals[ dindex + 1 ] = normals[ sindex + 1 ];
        normals[ dindex + 2 ] = normals[ sindex + 2 ];
      }
    }
    cur = 0;
    for( let h = 0; h != this.cloth.height - 1; h++ ) {
      for( let w = 0; w != this.cloth.width - 1; w++ ) {
        let i = [
          w + h * this.cloth.width,
          w + 1 + h * this.cloth.width,
          w + ( h + 1 ) * this.cloth.width,
          w + 1 + ( h + 1 ) * this.cloth.width
        ];
        let p = i.map( ( index ) => this.cloth.particles[ index ].position );
        let n = i.map( ( index ) => normals.subarray( index * 3, index * 3 + 3 ) );
        let u = i.map( ( index ) => this.cloth.particles[ index ].texcoord );
        //let n = normalize( cross( numeric.sub( p[ 1 ], p[ 0 ] ), numeric.sub( p[ 2 ], p[ 0 ] ) ) );
        t.map( ( i ) => {
          mesh[ cur * this.vector_length + 0 ] = p[ i ][ 0 ];
          mesh[ cur * this.vector_length + 1 ] = p[ i ][ 1 ];
          mesh[ cur * this.vector_length + 2 ] = p[ i ][ 2 ];
          mesh[ cur * this.vector_length + 3 ] = n[ i ][ 0 ];
          mesh[ cur * this.vector_length + 4 ] = n[ i ][ 1 ];
          mesh[ cur * this.vector_length + 5 ] = n[ i ][ 2 ];
          mesh[ cur * this.vector_length + 6 ] = u[ i ][ 0 ];
          mesh[ cur * this.vector_length + 7 ] = u[ i ][ 1 ];
          cur++;
        } );
      }
    }
    if( this.buffer === undefined ) {
      this.buffer = gl.createBuffer();
    }
    gl.bindBuffer( gl.ARRAY_BUFFER, this.buffer );
    gl.bufferData( gl.ARRAY_BUFFER, mesh, gl.STREAM_DRAW );
    gl.bindBuffer( gl.ARRAY_BUFFER, null );
    this.buffer_size = mesh.length;
  }
  test_mesh() {
    let gl = this.gl;
    this.vector_length = 8;
    let mesh = new Float32Array( [
      0.0, 0.0, 0.0,  0.0, 0.0, 1.0,  0.0, 0.0,
      1.0, 0.0, 0.0,  0.0, 0.0, 1.0,  0.0, 0.0,
      0.0, 1.0, 0.0,  0.0, 0.0, 1.0,  0.0, 0.0
    ] );
    if( this.buffer === undefined ) {
      this.buffer = gl.createBuffer();
    }
    gl.bindBuffer( gl.ARRAY_BUFFER, this.buffer );
    gl.bufferData( gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW );
    gl.bindBuffer( gl.ARRAY_BUFFER, null );
    this.buffer_size = mesh.length;
  }
  draw_mesh() {
    let gl = this.gl;
    gl.useProgram( this.p0program );
    let pos_index = gl.getAttribLocation( this.p0program, 'pos' );
    let nor_index = gl.getAttribLocation( this.p0program, 'nor' );
    let tex_index = gl.getAttribLocation( this.p0program, 'tex' );
    let width = this.canvas.width;
    let height = this.canvas.height;
    gl.bindBuffer( gl.ARRAY_BUFFER, this.buffer );
    if( pos_index != -1 ) {
      gl.vertexAttribPointer( pos_index, 3, gl.FLOAT, false, this.vector_length * 4, 0 );
    }
    if( nor_index != -1 ) {
      gl.vertexAttribPointer( nor_index, 3, gl.FLOAT, true, this.vector_length * 4, 3 * 4 );
    }
    if( tex_index != -1 ) {
      gl.vertexAttribPointer( tex_index, 2, gl.FLOAT, false, this.vector_length * 4, 6 * 4 );
    }
    gl.drawArrays( gl.TRIANGLES, 0, this.buffer_size / this.vector_length );
    gl.bindBuffer( gl.ARRAY_BUFFER, null );
  }
  set_gravity( g ) {
    this.g = g;
  }
  render() {
    let left = window.screenLeft;
    let top = window.screenTop;
    this.cloth.update( 0.05, 10, [ left - this.left, top - this.top ], this.g );
    this.left = left;
    this.top = top;
    let gl = this.gl;
    this.gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
    this.generate_mesh();
    //this.test_mesh();
    this.draw_mesh();
    gl.flush();
  }
}


